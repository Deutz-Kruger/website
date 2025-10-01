import path from "node:path";

import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const caseTitleBlock = z.object({
  _block: z.literal("caseTitle"),
  title: z.string(),
  subHeading: z.string(),
});

const caseVideoBlock = z.object({
  _block: z.literal("caseVideo"),
  video: z.string(),
  animatedBg: z.boolean(),
});

const caseImageTextBlock = z.object({
  _block: z.literal("caseImageText"),
  image: z.object({
    image: z.string(),
    alt: z.string(),
  }),
  text: z.string(),
  textRight: z.boolean(),
});

const blocksUnion = z.discriminatedUnion("_block", [
  caseTitleBlock,
  caseVideoBlock,
  caseImageTextBlock,
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
  logo: z.object({
    image: z.string(),
    alt: z.string(),
  }),
});

export const caseSchema = z.object({
  slug: z.string(),
  lang: z.string(),
  client: z.string(),
  blocks: z.array(blocksUnion),
  casePreview: z.object({
    title: z.string(),
    previewImage: z.object({
      image: z.string(),
      alt: z.string(),
    }),
  }),
});

export const servicesSchema = z.array(
  z.object({
    title: z.string(),
    body: z.string(),
    icon: z.object({
      iconLogo: z.object({
        image: z.string(),
        alt: z.string(),
      }),
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
