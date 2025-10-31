import { type z } from "astro:content";

import { baseBlock } from "@/content/schemas/blockSchemas";

type Layout = z.infer<typeof baseBlock.shape.layout>;

export const generateGridPosition = (layout: Layout) => {
  let margin = "";
  let aspect = "";
  switch (layout.width) {
    case 1:
      aspect = "aspect-ratio: 8 / 9;";
      break;
    case 2:
      aspect = "aspect-ratio: 16 / 9;";
      break;
    case 3:
      aspect = "aspect-ratio: 27 / 9;";
      break;
    case 4:
      aspect = "aspect-ratio: 32 / 9;";
  }

  if (layout.width === 1) {
    if (layout.position % 2 === 0) {
      margin = "margin-left: auto;";
    } else {
      margin = "margin-right: auto;";
    }
  }

  return {
    grid: `grid-column-start: ${layout.position}; grid-column-end: span ${layout.width}; ${aspect}`,
    margin: margin,
  };
};
