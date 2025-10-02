import path from "node:path";

import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

export const imageField = z.object({
  image: z.string(),
  alt: z.string(),
});

export const caseTitleBlock = z.object({
  _block: z.literal("caseTitle"),
  title: z.string(),
  subHeading: z.string(),
});

export const caseVideoBlock = z.object({
  _block: z.literal("caseVideo"),
  video: z.string(),
  animatedBg: z.boolean(),
});

export const caseImageBlock = z.object({
  _block: z.literal("caseImage"),
  image: imageField,
  animatedBg: z.boolean(),
});

export const caseImageTextBlock = z.object({
  _block: z.literal("caseImageText"),
  image: imageField,
  text: z.string(),
  textRight: z.boolean(),
});

export const caseImageTextFullBlock = z.object({
  _block: z.literal("caseImageTextFull"),
  image: imageField,
  text: z.string(),
  textRight: z.boolean(),
});

export const caseImageFullBlock = z.object({
  _block: z.literal("caseImageFull"),
  image: imageField,
  animatedBg: z.boolean(),
});

export const blocksUnion = z.discriminatedUnion("_block", [
  caseTitleBlock,
  caseVideoBlock,
  caseImageTextBlock,
  caseImageBlock,
  caseImageTextFullBlock,
  caseImageFullBlock,
]);

export const settingsSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string(),
  legal: z.object({
    impressum: z.object({
      title: z.string(),
      body: z.string(),
    }),
    privacy: z.object({
      title: z.string(),
      body: z.string(),
    }),
  }),
});

export const layoutSchema = z.object({
  navItems: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
    }),
  ),
  footerItems: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
    }),
  ),
  logo: imageField,
});

export const caseSchema = z.object({
  slug: z.string(),
  lang: z.string(),
  client: z.string(),
  blocks: z.array(blocksUnion),
  casePreview: z.object({
    title: z.string(),
    previewImage: imageField,
  }),
});

export const servicesSchema = z.array(
  z.object({
    title: z.string(),
    body: z.string(),
    icon: z.object({
      iconLogo: imageField,
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

export const aboutSchema = z.object({
  lang: z.string(),
  headline: z.string(),
  body: z.string(),
});

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
