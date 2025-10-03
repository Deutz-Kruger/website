import { readFile } from "node:fs/promises";

import xxhash from "xxhash-wasm";

const { h64 } = await xxhash();

import { extname } from "node:path";

import type { MediaType } from "./schema";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];
const VIDEO_EXTENSIONS = [".mp4", ".webm"];

export const getMediaType = (filePath: string): MediaType => {
  const extension = extname(filePath);
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  return "unknown";
};

export const generateFileHash = async (filePath: string): Promise<string> => {
  const file = await readFile(filePath, "utf-8");
  const hash = h64(file).toString();
  return hash;
};
