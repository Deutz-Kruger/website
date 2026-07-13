import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";

import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { glob } from "glob";
import sharp from "sharp";

import type { LocalMediaFile, MediaType } from "./schema";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);

export const DEFAULT_MEDIA_ROOT = resolve("./src/content/media");
export const DEFAULT_PROJECT_ROOT = resolve(".");

const normalizePath = (path: string) => path.split(sep).join("/");

const getMediaType = (filePath: string): MediaType | undefined => {
  const extension = extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  return undefined;
};

const isDotFile = (relativePath: string) =>
  normalizePath(relativePath)
    .split("/")
    .some((part) => part.startsWith("."));

/** Generates a SHA-256 digest without buffering the entire media file. */
export const generateSha256 = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(new Uint8Array(chunk as Uint8Array));
  }
  return hash.digest("hex");
};

/** Runs asynchronous work with a fixed concurrency limit. */
export const mapConcurrent = async <T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runWorker),
  );
  return results;
};

const inspectFile = async (
  absolutePath: string,
  sourcePath: string,
): Promise<LocalMediaFile> => {
  const type = getMediaType(absolutePath);
  if (!type) {
    throw new Error(`Unsupported media file: ${sourcePath}`);
  }

  const sha256 = await generateSha256(absolutePath);

  if (type === "image") {
    const metadata = await sharp(absolutePath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Image dimensions unavailable: ${sourcePath}`);
    }
    return {
      absolutePath,
      sourcePath,
      sha256,
      type,
      width: metadata.width,
      height: metadata.height,
    };
  }

  const metadata = await ffprobe(absolutePath, { path: ffprobeStatic.path });
  const videoStream = metadata.streams.find(
    (stream) => stream.codec_type === "video",
  );
  if (!videoStream?.width || !videoStream.height) {
    throw new Error(`Video dimensions unavailable: ${sourcePath}`);
  }

  const duration = videoStream.duration
    ? Number.parseFloat(videoStream.duration)
    : undefined;

  return {
    absolutePath,
    sourcePath,
    sha256,
    type,
    width: videoStream.width,
    height: videoStream.height,
    duration: Number.isFinite(duration) ? duration : undefined,
  };
};

/** Scans supported local media and returns deterministic metadata. */
export const scanLocalMedia = async (options?: {
  mediaRoot?: string;
  projectRoot?: string;
  concurrency?: number;
}): Promise<LocalMediaFile[]> => {
  const mediaRoot = resolve(options?.mediaRoot ?? DEFAULT_MEDIA_ROOT);
  const projectRoot = resolve(options?.projectRoot ?? DEFAULT_PROJECT_ROOT);
  const relativePaths = await glob("**/*", {
    cwd: mediaRoot,
    dot: true,
    nodir: true,
  });

  const visiblePaths = relativePaths
    .filter((path) => !isDotFile(path))
    .sort((a, b) => a.localeCompare(b));

  const unsupported = visiblePaths.filter(
    (path) => !getMediaType(resolve(mediaRoot, path)),
  );
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported files in media directory:\n${unsupported.join("\n")}`,
    );
  }

  return mapConcurrent(
    visiblePaths,
    options?.concurrency ?? 4,
    async (path) => {
      const absolutePath = resolve(mediaRoot, path);
      const sourcePath = normalizePath(relative(projectRoot, absolutePath));
      return inspectFile(absolutePath, sourcePath);
    },
  );
};

/** Returns possible legacy upload names for a source file. */
export const getLegacyRemoteNames = (sourcePath: string): string[] => {
  const name = basename(sourcePath);
  return [...new Set([name, name.replace(" ", "_")])];
};
