import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SITE_URL = "https://deutzkrueger.de";
const CASE_SLUGS = ["bl-thermo", "kamikuratcg", "krumphof", "skaut"];
const LOCALES = ["en", "de"];

const readOutput = (path) =>
  readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");

const getTitle = (html) => html.match(/<title>(.*?)<\/title>/i)?.[1];
const getMeta = (html, name) =>
  html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`, "i"))?.[1];
const getCanonical = (html) =>
  html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1];
const getJsonLd = (html) => {
  const json = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
  )?.[1];
  return json ? JSON.parse(json) : undefined;
};
const assertAlternate = (html, hreflang, href) => {
  assert.match(
    html,
    new RegExp(
      `<link\\b(?=[^>]*\\brel="alternate")(?=[^>]*\\bhreflang="${hreflang}")(?=[^>]*\\bhref="${href}")[^>]*>`,
      "i",
    ),
    `Missing ${hreflang} alternate for ${href}`,
  );
};
const assertSafeHead = (html) => {
  assert.doesNotMatch(html, /<meta name="keywords"/i);
  assert.doesNotMatch(html, /href="javascript:|<script>alert\(/i);
};

const [
  englishHome,
  germanHome,
  germanImpressum,
  germanPrivacy,
  notFound,
  sitemap,
  robots,
] = await Promise.all([
  readOutput("en/index.html"),
  readOutput("de/index.html"),
  readOutput("de/impressum/index.html"),
  readOutput("de/privacy/index.html"),
  readOutput("404.html"),
  readOutput("sitemap-0.xml"),
  readOutput("robots.txt"),
]);

const productionBuild = /User-agent:\s*\*\s*Allow:\s*\//i.test(robots);
const expectedPageRobots = productionBuild
  ? "index, follow"
  : "noindex, nofollow";
const expectedNotFoundRobots = productionBuild
  ? "noindex, follow"
  : "noindex, nofollow";

for (const [locale, html] of [
  ["en", englishHome],
  ["de", germanHome],
]) {
  assert.match(html, new RegExp(`<html\\b[^>]*\\blang="${locale}"`, "i"));
  assert.equal(getCanonical(html), `${SITE_URL}/${locale}/`);
  assert.equal(getMeta(html, "robots"), expectedPageRobots);
  assert.equal(getMeta(html, "googlebot"), expectedPageRobots);
  assertAlternate(html, "en", `${SITE_URL}/en/`);
  assertAlternate(html, "de", `${SITE_URL}/de/`);
  assertAlternate(html, "x-default", `${SITE_URL}/en/`);
  assert.match(html, new RegExp(`${SITE_URL}/android-chrome-512x512\\.png`));
  assert.doesNotMatch(html, /web-app-manifest-512x512\.png/);
  assertSafeHead(html);

  const graph = getJsonLd(html)?.["@graph"];
  assert.deepEqual(
    graph.map((entry) => entry["@type"]),
    ["Organization", "WebSite"],
  );
}

const allCaseHtml = [];
for (const locale of LOCALES) {
  const localeTitles = new Set();
  const localeDescriptions = new Set();

  for (const slug of CASE_SLUGS) {
    const html = await readOutput(`${locale}/${slug}/index.html`);
    const canonical = `${SITE_URL}/${locale}/${slug}/`;
    const title = getTitle(html);
    const description = getMeta(html, "description");
    const jsonLd = getJsonLd(html);
    const graph = jsonLd?.["@graph"];

    allCaseHtml.push(html);
    assert.ok(title, `${canonical} is missing a title`);
    assert.ok(description, `${canonical} is missing a description`);
    localeTitles.add(title);
    localeDescriptions.add(description);
    assert.equal(getCanonical(html), canonical);
    assert.doesNotMatch(getCanonical(html), /[?#]/);
    assert.equal(getMeta(html, "robots"), expectedPageRobots);
    assert.match(
      html,
      /<meta property="og:image" content="https:\/\/imagedelivery\.net\/[^"]+\/public"/i,
    );
    assert.match(html, /<meta property="og:image:width" content="\d+"/i);
    assert.match(html, /<meta property="og:image:height" content="\d+"/i);
    assertAlternate(html, "en", `${SITE_URL}/en/${slug}/`);
    assertAlternate(html, "de", `${SITE_URL}/de/${slug}/`);
    assertAlternate(html, "x-default", `${SITE_URL}/en/${slug}/`);
    assert.deepEqual(
      graph.map((entry) => entry["@type"]),
      ["WebPage", "CreativeWork", "ImageObject"],
    );
    assert.equal(graph[0].url, canonical);
    assert.equal(graph[0].description, graph[1].description);
    assert.match(graph[2].url, /^https:\/\/imagedelivery\.net\/.*\/public$/);
    assertSafeHead(html);
  }

  assert.equal(localeTitles.size, CASE_SLUGS.length);
  assert.equal(localeDescriptions.size, CASE_SLUGS.length);
}

for (const html of [germanImpressum, germanPrivacy]) {
  assert.doesNotMatch(html, /hreflang=/i);
  assert.equal(getMeta(html, "robots"), expectedPageRobots);
  assertSafeHead(html);
}

assert.equal(getMeta(notFound, "robots"), expectedNotFoundRobots);
assert.equal(getMeta(notFound, "googlebot"), expectedNotFoundRobots);
assert.equal(getCanonical(notFound), undefined);
assert.equal(getJsonLd(notFound), undefined);
assertSafeHead(notFound);

await assert.rejects(readOutput("en/impressum/index.html"), /ENOENT/);
await assert.rejects(readOutput("en/privacy/index.html"), /ENOENT/);
await assert.rejects(readOutput("en/about/index.html"), /ENOENT/);
await assert.rejects(readOutput("de/about/index.html"), /ENOENT/);

assert.match(englishHome, /href="\/de\/impressum\/"/i);
assert.match(englishHome, /href="\/de\/privacy\/"/i);
assert.doesNotMatch(
  [
    englishHome,
    germanHome,
    germanImpressum,
    germanPrivacy,
    ...allCaseHtml,
  ].join("\n"),
  /href="\/(?:en|de)\/about\/?"/i,
);

const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => match[1],
);
const expectedSitemapLocations = [
  `${SITE_URL}/de/`,
  ...CASE_SLUGS.map((slug) => `${SITE_URL}/de/${slug}/`),
  `${SITE_URL}/de/impressum/`,
  `${SITE_URL}/de/privacy/`,
  `${SITE_URL}/en/`,
  ...CASE_SLUGS.map((slug) => `${SITE_URL}/en/${slug}/`),
].sort();

assert.deepEqual([...sitemapLocations].sort(), expectedSitemapLocations);
assert.equal(sitemapLocations.length, 12);
assert.doesNotMatch(sitemap, /\/(?:en|de)\/about\//i);
assert.doesNotMatch(sitemap, /\/en\/(?:impressum|privacy)\//i);
assert.doesNotMatch(sitemap, new RegExp(`<loc>${SITE_URL}/</loc>`));
assert.doesNotMatch(sitemap, /<lastmod>/);

for (const path of ["de/impressum", "de/privacy"]) {
  const block = sitemap.match(
    new RegExp(`<url><loc>${SITE_URL}/${path}/</loc>([\\s\\S]*?)</url>`),
  )?.[0];
  assert.ok(block, `Missing sitemap entry for ${path}`);
  assert.doesNotMatch(block, /xhtml:link/);
}

assert.match(robots, new RegExp(`Sitemap: ${SITE_URL}/sitemap-index\\.xml`));

console.log("Build output verification passed");
