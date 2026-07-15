import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SITE_URL = "https://deutzkrueger.de";

const readOutput = (path) =>
  readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");

const [englishHtml, germanHtml, sitemap] = await Promise.all([
  readOutput("en/index.html"),
  readOutput("de/index.html"),
  readOutput("sitemap-0.xml"),
]);

assert.match(englishHtml, /<html\b[^>]*\blang="en"/i);
assert.match(germanHtml, /<html\b[^>]*\blang="de"/i);

for (const [locale, html] of [
  ["en", englishHtml],
  ["de", germanHtml],
]) {
  assert.match(
    html,
    new RegExp(
      `<link\\b(?=[^>]*\\brel="alternate")(?=[^>]*\\bhreflang="en")(?=[^>]*\\bhref="${SITE_URL}/en/")[^>]*>`,
      "i",
    ),
    `${locale} page is missing its English alternate`,
  );
  assert.match(
    html,
    new RegExp(
      `<link\\b(?=[^>]*\\brel="alternate")(?=[^>]*\\bhreflang="de")(?=[^>]*\\bhref="${SITE_URL}/de/")[^>]*>`,
      "i",
    ),
    `${locale} page is missing its German alternate`,
  );
  assert.match(
    html,
    new RegExp(
      `<link\\b(?=[^>]*\\brel="alternate")(?=[^>]*\\bhreflang="x-default")(?=[^>]*\\bhref="${SITE_URL}/en/")[^>]*>`,
      "i",
    ),
    `${locale} page is missing its x-default alternate`,
  );
  assert.match(html, new RegExp(`${SITE_URL}/android-chrome-512x512\\.png`));
  assert.doesNotMatch(html, /web-app-manifest-512x512\.png/);
  assert.doesNotMatch(html, /href="javascript:|<script>alert\(/i);
}

assert.doesNotMatch(
  sitemap,
  new RegExp(`<loc>${SITE_URL}/</loc>`),
  "redirect-only root URL must not appear in the sitemap",
);
assert.doesNotMatch(
  sitemap,
  /<lastmod>/,
  "sitemap must not claim every page changed at build time",
);

console.log("Build output verification passed");
