import { z } from "astro:content";

export const imageField = z.object({
  src: z.string(),
  alt: z.string(),
});

export const imagesField = z.array(imageField);

export const layoutField = z.object({
  width: z.string().transform((val) => parseInt(val)),
  position: z.string().transform((val) => parseInt(val)),
});

export const backgroundField = z.object({
  background: z.enum(["none", "static", "gradient"]),
  background_colors: z.array(z.string()).optional(),
});
