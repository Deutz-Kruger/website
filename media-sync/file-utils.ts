import { readFile } from "node:fs/promises";

import xxhash from "xxhash-wasm";

const { h64 } = await xxhash();

import { extname } from "node:path";

import type { MediaType } from "./schema";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];
const VIDEO_EXTENSIONS = [".mp4", ".webm"];

/**
 * Determines the media type of a file based on its extension.
 * @param filePath - The path to the file.
 * @returns The media type ('image', 'video', or 'unknown').
 */
export const getMediaType = (filePath: string): MediaType => {
  const extension = extname(filePath);
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  return "unknown";
};

/**
 * Generates a 64-bit XXH64 hash for the content of a given file.
 * @param filePath - The path to the file.
 * @returns A promise that resolves to the hash as a string.
 */
export const generateFileHash = async (filePath: string): Promise<string> => {
  const file = await readFile(filePath, "utf-8");
  const hash = h64(file).toString();
  return hash;
};
