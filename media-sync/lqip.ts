import { spawn } from "node:child_process";

import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

import { type Lqip, LQIP_MAX_DIMENSION, lqipSchema } from "./schema";

const FFMPEG_TIMEOUT_MS = 30_000;
const FFMPEG_PREFLIGHT_TIMEOUT_MS = 5_000;
const FFMPEG_MAX_OUTPUT_BYTES = 1024 * 1024;
const FFMPEG_MAX_ERROR_BYTES = 64 * 1024;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const combineChunks = (chunks: Buffer[], length: number): Buffer => {
  const combined = Buffer.allocUnsafe(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
};

const runFfmpeg = (
  binaryPath: string,
  args: string[],
  timeoutMs: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let outputBytes = 0;
    let errorBytes = 0;
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGKILL");
      reject(error);
    };

    const timeout = setTimeout(() => {
      rejectOnce(new Error(`FFmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > FFMPEG_MAX_OUTPUT_BYTES) {
        rejectOnce(
          new Error(`FFmpeg output exceeded ${FFMPEG_MAX_OUTPUT_BYTES} bytes`),
        );
        return;
      }
      output.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (errorBytes >= FFMPEG_MAX_ERROR_BYTES) return;
      const remaining = FFMPEG_MAX_ERROR_BYTES - errorBytes;
      const boundedChunk = chunk.subarray(0, remaining);
      errors.push(boundedChunk);
      errorBytes += boundedChunk.length;
    });

    child.once("error", (error) => {
      rejectOnce(new Error(`Unable to start FFmpeg: ${error.message}`));
    });

    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        const details = combineChunks(errors, errorBytes)
          .toString("utf8")
          .trim();
        reject(
          new Error(
            `FFmpeg exited with ${code ?? signal ?? "unknown status"}${details ? `: ${details}` : ""}`,
          ),
        );
        return;
      }
      resolve(combineChunks(output, outputBytes));
    });
  });

const encodeLqip = async (
  input: string | Buffer,
  hasAlphaOverride?: boolean,
): Promise<Lqip> => {
  const image = sharp(input).rotate();
  const metadata = await image.metadata();
  const { data, info } = await image
    .resize({
      width: LQIP_MAX_DIMENSION,
      height: LQIP_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 35,
      alphaQuality: 35,
      effort: 4,
    })
    .toBuffer({ resolveWithObject: true });

  return lqipSchema.parse({
    src: `data:image/webp;base64,${data.toString("base64")}`,
    width: info.width,
    height: info.height,
    hasAlpha: hasAlphaOverride ?? metadata.hasAlpha ?? false,
  });
};

/** Verifies the pinned FFmpeg binary before any video processing begins. */
export const preflightFfmpeg = async (
  binaryPath = ffmpegPath,
): Promise<void> => {
  if (!binaryPath) {
    throw new Error(
      "FFmpeg is unavailable for this platform. Reinstall dependencies and rerun pnpm sync-media.",
    );
  }
  await runFfmpeg(
    binaryPath,
    ["-hide_banner", "-version"],
    FFMPEG_PREFLIGHT_TIMEOUT_MS,
  );
};

/** Generates a deterministic inline WebP placeholder from a source image. */
export const generateImageLqip = async (
  absolutePath: string,
  sourcePath = absolutePath,
): Promise<Lqip> => {
  try {
    return await encodeLqip(absolutePath);
  } catch (error) {
    throw new Error(
      `LQIP generation failed for ${sourcePath}: ${errorMessage(error)}`,
    );
  }
};

/** Extracts and encodes the first video frame as an inline WebP placeholder. */
export const generateVideoLqip = async (
  absolutePath: string,
  sourcePath = absolutePath,
  options?: {
    binaryPath?: string | null;
    timeoutMs?: number;
  },
): Promise<Lqip> => {
  const binaryPath = options?.binaryPath ?? ffmpegPath;
  if (!binaryPath) {
    throw new Error(
      `LQIP generation failed for ${sourcePath}: FFmpeg is unavailable for this platform`,
    );
  }

  try {
    const frame = await runFfmpeg(
      binaryPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0",
        "-i",
        absolutePath,
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-an",
        "-sn",
        "-dn",
        "-vf",
        `scale=${LQIP_MAX_DIMENSION}:${LQIP_MAX_DIMENSION}:force_original_aspect_ratio=decrease`,
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
      ],
      options?.timeoutMs ?? FFMPEG_TIMEOUT_MS,
    );
    return await encodeLqip(frame, false);
  } catch (error) {
    throw new Error(
      `LQIP generation failed for ${sourcePath}: ${errorMessage(error)}`,
    );
  }
};
