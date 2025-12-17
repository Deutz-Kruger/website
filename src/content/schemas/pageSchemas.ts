import { z } from "astro:content";

import { groupsSchema } from "./blockSchemas";
import { imageField } from "./fieldSchemas";

export const casePreviewSchema = z.array(z.string());

export const servicesSchema = z.array(
  z.object({
    title: z.string(),
    body: z.string(),
    icon: z.object({
      icon_logo: imageField,
      icon_color: z.string(),
    }),
  }),
);

export const landingPageSchema = z.object({
  lang: z.string(),
  hero: z.object({
    headline: z.string(),
    contact: z.string(),
  }),
  cases: casePreviewSchema,
  services: servicesSchema,
});

export const aboutSchema = z.object({
  lang: z.string(),
  headline: z.string(),
  body: z.string(),
});

export const caseSchema = z.object({
  slug: z.string(),
  lang: z.string(),
  client: z.string(),
  groups: groupsSchema,
  case_preview: z.object({
    title: z.string(),
    preview_image: imageField,
  }),
});
