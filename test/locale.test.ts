import assert from "node:assert/strict";
import test from "node:test";

import { getLocaleAlternates, getLocaleFromPath } from "../src/utils/locale";

test("getLocaleFromPath only accepts supported leading path segments", () => {
  assert.equal(getLocaleFromPath("/en/work"), "en");
  assert.equal(getLocaleFromPath("/de/"), "de");
  assert.equal(getLocaleFromPath("/fr/work"), undefined);
  assert.equal(getLocaleFromPath("/work/de"), undefined);
});

test("getLocaleAlternates builds reciprocal localized URLs", () => {
  assert.deepEqual(
    getLocaleAlternates("https://deutzkrueger.de/", "/de/kamikuratcg/"),
    {
      de: "https://deutzkrueger.de/de/kamikuratcg/",
      en: "https://deutzkrueger.de/en/kamikuratcg/",
      xDefault: "https://deutzkrueger.de/en/kamikuratcg/",
    },
  );

  assert.deepEqual(getLocaleAlternates("https://deutzkrueger.de", "/en/"), {
    de: "https://deutzkrueger.de/de/",
    en: "https://deutzkrueger.de/en/",
    xDefault: "https://deutzkrueger.de/en/",
  });
  assert.equal(getLocaleAlternates("https://deutzkrueger.de", "/"), undefined);
});
