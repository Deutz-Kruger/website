import { z } from "astro:content";

import { imageField } from "./fieldSchemas";

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
  nav_items: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
    }),
  ),
  footer_items: z.array(
    z.object({
      href: z.string(),
      title: z.string(),
    }),
  ),
  logo: imageField,
});
