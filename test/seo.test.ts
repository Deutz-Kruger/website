import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalUrl,
  getCaseSeoData,
  getRobotsContent,
  normalizeMetaDescription,
} from "../src/utils/seo";

test("buildCanonicalUrl removes queries and fragments", () => {
  assert.equal(
    buildCanonicalUrl(
      "https://deutzkrueger.de/",
      "/de/skaut/?utm_source=test#work",
    ),
    "https://deutzkrueger.de/de/skaut/",
  );
});

test("normalizeMetaDescription preserves words within the length limit", () => {
  const description = normalizeMetaDescription(
    "A   deliberately long description ".repeat(10),
    80,
  );

  assert.ok(description.length <= 80);
  assert.match(description, /…$/);
  assert.doesNotMatch(description, /\s{2,}/);
});

test("getRobotsContent blocks previews and follows links on production 404s", () => {
  assert.equal(getRobotsContent("production"), "index, follow");
  assert.equal(getRobotsContent("production", true), "noindex, follow");
  assert.equal(getRobotsContent("preview"), "noindex, nofollow");
  assert.equal(getRobotsContent("development", true), "noindex, nofollow");
});

test("getCaseSeoData derives metadata and structured data from case fields", () => {
  const seo = getCaseSeoData(
    {
      lang: "de",
      tags: ["UI/UX Design", "Web App"],
      groups: [
        {
          blocks: [
            {
              _block: "title",
              title: "Skaut Backoffice Ticketing System",
              subHeading:
                "SKAUT ist ein internes Ticketing- und Managementsystem für präzise Workflows.",
            },
          ],
        },
      ],
    },
    "https://deutzkrueger.de",
    "/de/skaut/?preview=true",
    {
      url: "https://imagedelivery.net/account/image/large",
      alt: "skaut_preview",
      width: 1600,
      height: 900,
    },
  );

  assert.equal(seo.title, "Skaut Backoffice Ticketing System");
  assert.equal(seo.canonical, "https://deutzkrueger.de/de/skaut/");
  assert.equal(
    seo.description,
    "SKAUT ist ein internes Ticketing- und Managementsystem für präzise Workflows.",
  );

  const graph = seo.structuredData["@graph"] as Array<Record<string, unknown>>;
  assert.deepEqual(
    graph.map((entry) => entry["@type"]),
    ["WebPage", "CreativeWork", "ImageObject"],
  );
  assert.equal(graph[0].url, seo.canonical);
  assert.equal(graph[1].description, seo.description);
  assert.equal(graph[2].url, seo.socialImage.url);
});

test("getCaseSeoData rejects cases without title metadata", () => {
  assert.throws(
    () =>
      getCaseSeoData(
        {
          lang: "en",
          groups: [{ blocks: [{ _block: "text" }] }],
        },
        "https://deutzkrueger.de",
        "/en/missing-title/",
        {
          url: "https://imagedelivery.net/account/image/large",
          alt: "preview",
          width: 1600,
          height: 900,
        },
      ),
    /requires a title block for SEO/,
  );
});
