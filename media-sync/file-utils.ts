import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

import ffprobe from "ffprobe";
import ffprobeStatic from "ffprobe-static";
import { glob } from "glob";
import sharp from "sharp";

import {
  DEFAULT_MEDIA_ROOT,
  DEFAULT_PROJECT_ROOT,
  IMAGE_LQIP_CONCURRENCY,
  mapConcurrent,
  SCAN_CONCURRENCY,
  VIDEO_LQIP_CONCURRENCY,
} from "./config";
import { generateImageLqip, generateVideoLqip, preflightFfmpeg } from "./lqip";
import type { LocalMediaFile, MediaType } from "./schema";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);

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

const inspectFile = async (
  absolutePath: string,
  sourcePath: string,
): Promise<Omit<LocalMediaFile, "lqip">> => {
  const type = getMediaType(absolutePath);
  if (!type) {
    throw new Error(`Unsupported media file: ${sourcePath}`);
  }

  const sha256 = await generateSha256(absolutePath);

  if (type === "image") {
    const metadata = await sharp(absolutePath).metadata();
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    if (!width || !height) {
      throw new Error(`Image dimensions unavailable: ${sourcePath}`);
    }
    return {
      absolutePath,
      sourcePath,
      sha256,
      type,
      width,
      height,
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

/**
 * Generates LQIPs per media type and zips the results back onto the scanned
 * files by index, so equal source paths can never collide.
 */
const attachLqips = async (
  files: Array<Omit<LocalMediaFile, "lqip">>,
): Promise<LocalMediaFile[]> => {
  const imageIndexes: number[] = [];
  const videoIndexes: number[] = [];
  files.forEach((file, index) => {
    (file.type === "image" ? imageIndexes : videoIndexes).push(index);
  });
  const [imageLqips, videoLqips] = await Promise.all([
    mapConcurrent(imageIndexes, IMAGE_LQIP_CONCURRENCY, (index) =>
      generateImageLqip(files[index].absolutePath, files[index].sourcePath),
    ),
    (async () => {
      if (videoIndexes.length === 0) return [];
      await preflightFfmpeg();
      return mapConcurrent(videoIndexes, VIDEO_LQIP_CONCURRENCY, (index) =>
        generateVideoLqip(files[index].absolutePath, files[index].sourcePath),
      );
    })(),
  ]);

  const withLqips = new Array<LocalMediaFile>(files.length);
  imageIndexes.forEach((fileIndex, position) => {
    withLqips[fileIndex] = { ...files[fileIndex], lqip: imageLqips[position] };
  });
  videoIndexes.forEach((fileIndex, position) => {
    withLqips[fileIndex] = { ...files[fileIndex], lqip: videoLqips[position] };
  });
  return withLqips;
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

  const files = await mapConcurrent(
    visiblePaths,
    options?.concurrency ?? SCAN_CONCURRENCY,
    async (path) => {
      const absolutePath = resolve(mediaRoot, path);
      const sourcePath = normalizePath(relative(projectRoot, absolutePath));
      return inspectFile(absolutePath, sourcePath);
    },
  );
  return attachLqips(files);
};
