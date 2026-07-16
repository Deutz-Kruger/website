import assert from "node:assert/strict";
import test from "node:test";

import {
  getGermanLegalPath,
  getLocaleAlternates,
  getLocaleFromPath,
  isGermanLegalPath,
  resolveNavigationLocale,
} from "../src/utils/locale";

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

test("German-only legal routes map to their canonical paths", () => {
  assert.equal(getGermanLegalPath("/en/privacy/"), "/de/privacy/");
  assert.equal(getGermanLegalPath("/de/impressum"), "/de/impressum/");
  assert.equal(getGermanLegalPath("/en/skaut/"), undefined);
  assert.equal(isGermanLegalPath("/de/privacy/"), true);
  assert.equal(isGermanLegalPath("/en/privacy/"), false);
});

test("legal pages preserve preference without weakening normal URL sync", () => {
  assert.equal(resolveNavigationLocale("/de/privacy/", "en"), "en");
  assert.equal(resolveNavigationLocale("/de/privacy/"), "de");
  assert.equal(resolveNavigationLocale("/de/skaut/", "en"), "de");
  assert.equal(resolveNavigationLocale("/en/skaut/", "de"), "en");
});
