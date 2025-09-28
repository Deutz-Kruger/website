import path from "node:path";

import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/** Case preview resolution
type CollectionEntry,
import { getEntry } from "astro:content";
cases: z
    .array(z.string())
    .transform(async (casePaths): Promise<CollectionEntry<"cases">[]> => {
      const allEntries = await Promise.all(
        casePaths.map((casePath) => {
          const slug = path.basename(casePath, ".json");
          return getEntry("cases", slug);
        }),
      );
      return allEntries.filter(
        (entry): entry is CollectionEntry<"cases"> => entry !== undefined,
      );
    }),
*/
export const caseSchema = z.object({
  slug: z.string(),
  lang: z.string(),
  title: z.string(),
  description: z.string(),
  casePreview: z.object({
    title: z.string(),
    previewImage: z.string(),
  }),
});

export const servicesSchema = z.array(
  z.object({
    title: z.string(),
    body: z.string(),
    icon: z.object({
      iconLogo: z.string(),
      iconColor: z.string(),
    }),
  }),
);

export const casePreviewSchema = z.array(z.string());

export const landingPageSchema = z.object({
  lang: z.string(),
  hero: z.object({
    headline: z.string(),
  }),
  cases: casePreviewSchema,
  services: servicesSchema,
});

const cases = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/cases",
    generateId: ({ entry }) => path.basename(entry, ".json"),
  }),
  schema: caseSchema,
});

const landingPage = defineCollection({
  loader: glob({
    pattern: "**/*.json",
    base: "./src/content/pages/landing-page",
  }),
  schema: landingPageSchema,
});

export const collections = { cases, "landing-page": landingPage };
