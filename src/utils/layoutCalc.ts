import { type z } from "astro:content";

import { baseBlock } from "@/content/schemas/blockSchemas";

type Layout = z.infer<typeof baseBlock.shape.layout>;

export const generateGridPosition = (layout: Layout) => {
  return `grid-column-start: ${layout.position}; grid-column-end: span ${layout.width}`;
};
