import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

import { type Lqip, LQIP_MAX_DIMENSION, lqipSchema } from "./schema";

const FFMPEG_TIMEOUT_MS = 30_000;
const FFMPEG_PREFLIGHT_TIMEOUT_MS = 5_000;
const FFMPEG_MAX_OUTPUT_BYTES = 1024 * 1024;
const FFMPEG_MAX_ERROR_BYTES = 64 * 1024;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The subset of an execa failure that FFmpeg error reporting relies on. */
interface FfmpegFailure {
  code?: string;
  exitCode?: number;
  isMaxBuffer?: boolean;
  originalMessage?: string;
  signal?: string;
  stderr?: Uint8Array;
  stdout?: Uint8Array;
  timedOut?: boolean;
}

const asFfmpegFailure = (error: unknown): FfmpegFailure =>
  typeof error === "object" && error !== null ? (error as FfmpegFailure) : {};

const toBuffer = (value: Uint8Array | undefined): Buffer =>
  Buffer.from(value ?? new Uint8Array());

/** Bounds reported stderr so failures stay readable. */
const stderrDetails = (failure: FfmpegFailure): string =>
  toBuffer(failure.stderr)
    .subarray(0, FFMPEG_MAX_ERROR_BYTES)
    .toString("utf8")
    .trim();

/**
 * Runs FFmpeg with a hard timeout, a capped stdout, and bounded stderr.
 * A timeout or output overflow terminates the process immediately (SIGKILL).
 */
const runFfmpeg = async (
  binaryPath: string,
  args: string[],
  timeoutMs: number,
): Promise<Buffer> => {
  try {
    const { stdout } = await execa(binaryPath, args, {
      encoding: "buffer",
      killSignal: "SIGKILL",
      maxBuffer: {
        stdout: FFMPEG_MAX_OUTPUT_BYTES,
        stderr: FFMPEG_MAX_OUTPUT_BYTES,
      },
      stdin: "ignore",
      stripFinalNewline: false,
      timeout: timeoutMs,
    });
    return toBuffer(stdout);
  } catch (error) {
    const failure = asFfmpegFailure(error);
    if (failure.code) {
      throw new Error(
        `Unable to start FFmpeg: ${failure.originalMessage ?? failure.code}`,
        { cause: error },
      );
    }
    if (failure.timedOut) {
      throw new Error(`FFmpeg timed out after ${timeoutMs}ms`, {
        cause: error,
      });
    }
    if (
      failure.isMaxBuffer &&
      toBuffer(failure.stdout).length >= FFMPEG_MAX_OUTPUT_BYTES
    ) {
      throw new Error(
        `FFmpeg output exceeded ${FFMPEG_MAX_OUTPUT_BYTES} bytes`,
        { cause: error },
      );
    }
    const details = stderrDetails(failure);
    throw new Error(
      `FFmpeg exited with ${failure.exitCode ?? failure.signal ?? "unknown status"}${details ? `: ${details}` : ""}`,
      { cause: error },
    );
  }
};

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
      { cause: error },
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
      { cause: error },
    );
  }
};
