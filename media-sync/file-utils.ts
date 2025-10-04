import { readFile } from "node:fs/promises";

import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";
import xxhash from "xxhash-wasm";

const { h64Raw } = await xxhash();

import { extname } from "node:path";

import type { MediaType } from "./schema";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];
const VIDEO_EXTENSIONS = [".mp4", ".webm"];

/**
 * Determines the media type of a file based on its extension.
 * @param filePath - The path to the file.
 * @returns The media type ('image', 'video', or 'unknown').
 */
const getMediaType = (filePath: string): MediaType => {
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
const generateFileHash = async (file: Buffer): Promise<string> => {
  // const file = await readFile(filePath, "utf-8");
  const uInt8arr = new Uint8Array(file);
  const hash = h64Raw(uInt8arr);
  return hash.toString();
};

/**
 * Generates metadata for a given media file, including its hash, media type, and dimensions (if applicable).
 *
 * @param filePath - The path to the media file.
 * @returns A promise that resolves to an object containing the file's hash, media type, and optional width and height.
 *          - `hash`: The XXH64 hash of the file content.
 *          - `mediaType`: The determined media type ('image', 'video', or 'unknown').
 *          - `width`: The width of the media, if available (for images and videos).
 *          - `height`: The height of the media, if available (for images and videos).
 */
export const generateMetaData = async (filePath: string) => {
  const mediaType = getMediaType(filePath);
  const file = await readFile(filePath);
  const hash = await generateFileHash(file);
  try {
    if (mediaType === "image") {
      const metaData = await sharp(file).metadata();
      const { width, height } = metaData;
      return { hash, mediaType, width, height };
    }
    if (mediaType === "video") {
      const metaData = await ffprobe(filePath, { path: ffprobeStatic.path });
      const videoStream = metaData.streams.find(
        (s) => s.codec_type === "video",
      );
      if (videoStream) {
        return {
          hash,
          mediaType,
          width: videoStream.width,
          height: videoStream.height,
        };
      }
    }
  } catch (error) {
    console.error(`Failed to generate metadata for ${filePath}:`, error);
  }

  return { hash, mediaType, width: undefined, height: undefined };
};
