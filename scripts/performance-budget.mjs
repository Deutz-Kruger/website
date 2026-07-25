import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIRECTORY = path.resolve("dist");
const ASTRO_DIRECTORY = path.join(DIST_DIRECTORY, "_astro");
const MEDIA_MANIFEST_PATH = path.resolve("src/generated/media-manifest.json");
const EXPECTED_FONT = {
  file: "OpeningHoursSans-Regular.woff2",
  // hhea metrics normalized to the OS/2 typographic values: 780 / -220 / 200.
  sha256: "1f4f50af24f859a8dfd50f6c3e21fc23223c1158b361768a2cd5b31ab30a13f0",
};

const BUDGETS = {
  sitewideJavaScript: 50 * 1024,
  hlsJavaScript: 115 * 1024,
  css: 7 * 1024,
  fontAssets: 20 * 1024,
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

const expectedFontFiles = [EXPECTED_FONT.file];
const fontDirectory = path.join(DIST_DIRECTORY, "fonts");
const fontFiles = (await readdir(fontDirectory))
  .filter((file) => /\.(?:eot|otf|ttf|woff2?)$/i.test(file))
  .sort();
const fontAssets = (
  await Promise.all(
    fontFiles.map(
      async (file) => (await stat(path.join(fontDirectory, file))).size,
    ),
  )
).reduce((total, size) => total + size, 0);

if (fontFiles.join(",") !== expectedFontFiles.join(",")) {
  fail(`Unexpected font assets: ${fontFiles.join(", ") || "none"}`);
}

const fontPath = path.join(fontDirectory, EXPECTED_FONT.file);
const fontSha256 = fontFiles.includes(EXPECTED_FONT.file)
  ? createHash("sha256")
      .update(await readFile(fontPath))
      .digest("hex")
  : "";

if (fontSha256 !== EXPECTED_FONT.sha256) {
  fail(
    `Font checksum is ${fontSha256 || "unavailable"}; revalidate vertical metrics before updating the guard`,
  );
}

if (sitewideJavaScript > BUDGETS.sitewideJavaScript) {
  fail(`Sitewide JavaScript is ${sitewideJavaScript} bytes gzip`);
}
if (hlsJavaScript > BUDGETS.hlsJavaScript) {
  fail(`HLS light is ${hlsJavaScript} bytes gzip`);
}
if (css > BUDGETS.css) {
  fail(`CSS is ${css} bytes gzip`);
}
if (fontAssets > BUDGETS.fontAssets) {
  fail(`Font assets are ${fontAssets} bytes`);
}
if (mediaManifest > BUDGETS.mediaManifest) {
  fail(`Generated media manifest is ${mediaManifest} bytes`);
}

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

console.log("Performance budget report");
console.log(`  Sitewide JavaScript: ${kilobytes(sitewideJavaScript)} gzip`);
console.log(`  HLS light: ${kilobytes(hlsJavaScript)} gzip`);
console.log(`  CSS: ${kilobytes(css)} gzip`);
console.log(`  Font assets: ${kilobytes(fontAssets)}`);
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
