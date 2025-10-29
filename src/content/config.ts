import path from "node:path";

import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";

import {
  aboutSchema,
  caseSchema,
  landingPageSchema,
} from "./schemas/pageSchemas";
import { layoutSchema, settingsSchema } from "./schemas/settingsSchemas";

const cases = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/cases",
    generateId: ({ entry }) => path.basename(entry, ".json"),
  }),
  schema: caseSchema,
});

const about = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/pages/about",
  }),
  schema: aboutSchema,
});

const landingPage = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/pages/landing-page",
  }),
  schema: landingPageSchema,
});

const layout = defineCollection({
  loader: glob({
    pattern: "layout.json",
    base: "./src/content/settings",
  }),
  schema: layoutSchema,
});

const settings = defineCollection({
  loader: glob({
    pattern: "settings.json",
    base: "./src/content/settings",
  }),
  schema: settingsSchema,
});

export const collections = {
  cases,
  "landing-page": landingPage,
  layout,
  settings,
  about,
};
