import { z } from "astro:content";

import { backgroundField, imagesField, layoutField } from "./fieldSchemas";

export const baseBlock = z.object({
  background: backgroundField,
  layout: layoutField,
});

export const titleBlock = z.object({
  _block: z.literal("title"),
  title: z.string(),
  subHeading: z.string(),
  base: baseBlock,
});

export const videoBlock = z.object({
  _block: z.literal("video"),
  video: z.string(),
  base: baseBlock,
});

export const imageBlock = z.object({
  _block: z.literal("image"),
  images: imagesField,
  base: baseBlock,
});

export const textBlock = z.object({
  _block: z.literal("text"),
  text: z.string(),
  base: baseBlock,
});

export const blocksUnion = z.discriminatedUnion("_block", [
  titleBlock,
  imageBlock,
  videoBlock,
  textBlock,
]);

export const groupSchema = z.object({
  _block: z.literal("group"),
  blocks: z.array(blocksUnion),
});

export const groupsSchema = z.array(groupSchema);
