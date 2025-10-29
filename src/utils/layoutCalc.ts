import { type z } from "astro:content";

import { baseBlock } from "@/content/schemas/blockSchemas";

type Layout = z.infer<typeof baseBlock.shape.layout>;

export const generateGridPosition = (layout: Layout) => {
  let aspect = "";
  switch (layout.width) {
    case 1:
      aspect = "aspect-ratio: 3 / 4;";
      break;
    case 2:
      aspect = "aspect-ratio: 16 / 9;";
      break;
    case 3:
      aspect = "aspect-ratio: 19 / 13;";
      break;
    case 4:
      aspect = "aspect-ratio: 32 / 9;";
  }

  return `grid-column-start: ${layout.position}; grid-column-end: span ${layout.width}; ${aspect}`;
};
