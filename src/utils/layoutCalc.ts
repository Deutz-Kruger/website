import { type z } from "astro:content";

import { baseBlock } from "@/content/schemas/blockSchemas";

type Layout = z.infer<typeof baseBlock.shape.layout>;

type Margin = "LEFT" | "RIGHT" | "NONE";

export const generateGridPosition = (layout: Layout) => {
  const aspect = aspectRatioFromSpan(layout.width);
  const margin = marginSideFromPosition(layout);
  const desktopStart = clamp(layout.position, 4);
  const desktopSpan = clamp(layout.width, 4);
  const mobileSpan = 1;

  return {
    aspect,
    margin,
    desktopStart,
    desktopSpan,
    mobileSpan,
  };
};

const aspectRatioFromSpan = (span: number) => {
  const aspect = { width: 16, height: 9 };
  switch (span) {
    case 1:
      aspect.width = 8;
      break;
    case 2:
      aspect.width = 16;
      break;
    case 3:
      aspect.width = 27;
      break;
    case 4:
      aspect.width = 32;
  }
  return aspect;
};

const marginSideFromPosition = (layout: Layout): Margin => {
  if (layout.width === 1) {
    if (layout.position % 2 === 0) {
      return "LEFT";
    } else {
      return "RIGHT";
    }
  }
  return "NONE";
};

const clamp = (val: number, gridCols: number) =>
  Math.min(Math.max(val, 1), gridCols);
