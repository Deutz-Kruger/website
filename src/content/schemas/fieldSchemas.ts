import { z } from "astro:content";

export const imageField = z.object({
  src: z.string(),
  alt: z.string(),
});

export const imagesField = z.array(imageField).min(1);

const gridValue = z.coerce.number().int().min(1).max(4);

export const layoutField = z
  .object({
    width: gridValue,
    position: gridValue,
  })
  .refine(({ position, width }) => position + width - 1 <= 4, {
    message: "Grid block must fit within four columns",
    path: ["position"],
  });

export const backgroundField = z.object({
  background: z.enum(["none", "static", "gradient"]),
  background_colors: z.array(z.string()).optional(),
});
