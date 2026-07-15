import { z } from "astro:content";

import { groupsSchema } from "./blockSchemas";
import { imageField } from "./fieldSchemas";

export const casePreviewSchema = z.array(z.string());
const localeSchema = z.enum(["en", "de"]);
const serviceSchema = z
  .object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1).optional(),
    bodyRich: z.string().trim().min(1).optional(),
    icon: z.object({
      icon_logo: imageField,
      icon_color: z.string(),
    }),
  })
  .refine(({ body, bodyRich }) => Boolean(body || bodyRich), {
    message: "Service requires body or bodyRich content",
    path: ["body"],
  });

export const servicesSchema = z.array(serviceSchema);

export const landingPageSchema = z.object({
  lang: localeSchema,
  hero: z.object({
    headline: z.string(),
    contact: z.string(),
  }),
  cases: casePreviewSchema,
  services: servicesSchema,
});

export const aboutSchema = z.object({
  lang: localeSchema,
  headline: z.string(),
  body: z.string(),
});

export const caseSchema = z.object({
  slug: z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lang: localeSchema,
  client: z.string(),
  tags: z.array(z.string()).optional(),
  groups: groupsSchema,
  case_preview: z.object({
    title: z.string(),
    preview_image: imageField,
  }),
});
