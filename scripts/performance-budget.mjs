import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIRECTORY = path.resolve("dist");
const ASTRO_DIRECTORY = path.join(DIST_DIRECTORY, "_astro");
const MEDIA_MANIFEST_PATH = path.resolve("src/generated/media-manifest.json");

const BUDGETS = {
  sitewideJavaScript: 50 * 1024,
  hlsJavaScript: 115 * 1024,
  css: 7 * 1024,
  fontReduction: 0.2,
  eagerImagesPerRoute: 2,
  eagerImagesPerCaseRoute: 3,
  lqipPerRoute: 12 * 1024,
  lqipPerCaseRoute: 32 * 1024,
  mediaManifest: 128 * 1024,
};

const CASE_SLUGS = new Set(["bl-thermo", "kamikuratcg", "krumphof", "skaut"]);

const failures = [];

const fail = (message) => {
  failures.push(message);
};

const gzipSize = async (filePath) =>
  gzipSync(await readFile(filePath)).byteLength;

const findFiles = async (directory, predicate) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(entryPath, predicate)));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
};

const assetPathFromUrl = (assetUrl) =>
  path.join(DIST_DIRECTORY, assetUrl.replace(/^\//, ""));

const collectStaticJavaScript = async (entryPath, files = new Set()) => {
  if (files.has(entryPath)) return files;

  files.add(entryPath);
  const source = await readFile(entryPath, "utf8");
  const staticImportPattern =
    /\bimport(?!\s*\()(?:[^"'`;]*?from\s*)?["']([^"']+)["']/g;

  for (const match of source.matchAll(staticImportPattern)) {
    const importPath = match[1];
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) continue;

    const resolvedPath = importPath.startsWith("/")
      ? assetPathFromUrl(importPath)
      : path.resolve(path.dirname(entryPath), importPath);
    await collectStaticJavaScript(resolvedPath, files);
  }

  return files;
};

const htmlFiles = await findFiles(DIST_DIRECTORY, (filePath) =>
  filePath.endsWith(".html"),
);
const routeMetrics = [];

for (const htmlPath of htmlFiles) {
  const html = await readFile(htmlPath, "utf8");
  const routePath = path
    .relative(DIST_DIRECTORY, htmlPath)
    .split(path.sep)
    .join("/");
  const scriptUrls = [
    ...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g),
  ].map((match) => match[1]);
  const cssUrls = [
    ...html.matchAll(
      /<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="([^"]+\.css)")[^>]*>/g,
    ),
  ].map((match) => match[1]);
  const eagerImages = [...html.matchAll(/\bloading="eager"/g)].length;
  const lqipBytes = [
    ...html.matchAll(
      /<img\b(?=[^>]*\bdata-media-lqip\b)[^>]*\bsrc="(data:image\/webp;base64,[^"]+)"[^>]*>/gi,
    ),
  ].reduce((total, match) => total + Buffer.byteLength(match[1]), 0);
  const routeSegments = routePath.split("/");
  const isCaseRoute = CASE_SLUGS.has(routeSegments[1]);
  const eagerImageLimit = isCaseRoute
    ? BUDGETS.eagerImagesPerCaseRoute
    : BUDGETS.eagerImagesPerRoute;
  const lqipLimit = isCaseRoute
    ? BUDGETS.lqipPerCaseRoute
    : BUDGETS.lqipPerRoute;

  if (scriptUrls.length > 1) {
    fail(
      `${path.relative(DIST_DIRECTORY, htmlPath)} has ${scriptUrls.length} direct client scripts`,
    );
  }
  if (eagerImages > eagerImageLimit) {
    fail(
      `${routePath} has ${eagerImages} eager images (limit ${eagerImageLimit})`,
    );
  }
  if (lqipBytes > lqipLimit) {
    fail(
      `${routePath} has ${lqipBytes} inline LQIP bytes (limit ${lqipLimit})`,
    );
  }

  const javaScriptFiles = new Set();
  for (const scriptUrl of scriptUrls) {
    await collectStaticJavaScript(assetPathFromUrl(scriptUrl), javaScriptFiles);
  }

  const sitewideJavaScript = (
    await Promise.all([...javaScriptFiles].map(gzipSize))
  ).reduce((total, size) => total + size, 0);
  const css = (
    await Promise.all(cssUrls.map((url) => gzipSize(assetPathFromUrl(url))))
  ).reduce((total, size) => total + size, 0);

  routeMetrics.push({ eagerImages, lqipBytes, sitewideJavaScript, css });
}

const clientFiles = await readdir(ASTRO_DIRECTORY);
const javaScriptFiles = clientFiles.filter((file) => file.endsWith(".js"));
const emptyJavaScriptFiles = [];

for (const file of javaScriptFiles) {
  const source = await readFile(path.join(ASTRO_DIRECTORY, file), "utf8");
  if (!source.trim()) emptyJavaScriptFiles.push(file);
}

if (emptyJavaScriptFiles.length) {
  fail(`Empty client chunks: ${emptyJavaScriptFiles.join(", ")}`);
}

const hlsFiles = javaScriptFiles.filter((file) =>
  file.startsWith("hls.light."),
);
if (hlsFiles.length !== 1) {
  fail(`Expected one HLS light chunk, found ${hlsFiles.length}`);
}

const hlsJavaScript = hlsFiles.length
  ? await gzipSize(path.join(ASTRO_DIRECTORY, hlsFiles[0]))
  : 0;
const sitewideJavaScript = Math.max(
  ...routeMetrics.map((metric) => metric.sitewideJavaScript),
);
const css = Math.max(...routeMetrics.map((metric) => metric.css));
const eagerImages = Math.max(
  ...routeMetrics.map((metric) => metric.eagerImages),
);
const lqipBytes = Math.max(...routeMetrics.map((metric) => metric.lqipBytes));
const mediaManifest = (await stat(MEDIA_MANIFEST_PATH)).size;

const fontNames = ["ArialRegular", "ArialItalic"];
let woffBytes = 0;
let woff2Bytes = 0;

for (const fontName of fontNames) {
  woffBytes += (
    await stat(path.join(DIST_DIRECTORY, "fonts", `${fontName}.woff`))
  ).size;
  woff2Bytes += (
    await stat(path.join(DIST_DIRECTORY, "fonts", `${fontName}.woff2`))
  ).size;
}

const fontReduction = 1 - woff2Bytes / woffBytes;

if (sitewideJavaScript > BUDGETS.sitewideJavaScript) {
  fail(`Sitewide JavaScript is ${sitewideJavaScript} bytes gzip`);
}
if (hlsJavaScript > BUDGETS.hlsJavaScript) {
  fail(`HLS light is ${hlsJavaScript} bytes gzip`);
}
if (css > BUDGETS.css) {
  fail(`CSS is ${css} bytes gzip`);
}
if (fontReduction < BUDGETS.fontReduction) {
  fail(`WOFF2 font reduction is ${(fontReduction * 100).toFixed(2)}%`);
}
if (mediaManifest > BUDGETS.mediaManifest) {
  fail(`Generated media manifest is ${mediaManifest} bytes`);
}

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

console.log("Performance budget report");
console.log(`  Sitewide JavaScript: ${kilobytes(sitewideJavaScript)} gzip`);
console.log(`  HLS light: ${kilobytes(hlsJavaScript)} gzip`);
console.log(`  CSS: ${kilobytes(css)} gzip`);
console.log(`  WOFF2 reduction: ${(fontReduction * 100).toFixed(2)}%`);
console.log(`  Maximum eager images per route: ${eagerImages}`);
console.log(`  Maximum inline LQIP data per route: ${kilobytes(lqipBytes)}`);
console.log(`  Generated media manifest: ${kilobytes(mediaManifest)}`);
console.log(
  `  Client chunks: ${javaScriptFiles.length} (${emptyJavaScriptFiles.length} empty)`,
);

if (failures.length) {
  console.error("\nPerformance budgets failed:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
}
