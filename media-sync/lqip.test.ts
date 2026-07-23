import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

import { generateImageLqip, generateVideoLqip, preflightFfmpeg } from "./lqip";
import { LQIP_MAX_DATA_URI_LENGTH, lqipSchema, manifestSchema } from "./schema";

const runBinary = (binaryPath: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(binaryPath, args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

test("image LQIPs are deterministic, bounded, aspect-correct WebP", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-lqip-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const imagePath = join(directory, "alpha.png");
  await sharp({
    create: {
      width: 64,
      height: 32,
      channels: 4,
      background: { r: 20, g: 80, b: 160, alpha: 0.5 },
    },
  })
    .png()
    .toFile(imagePath);

  const first = await generateImageLqip(imagePath, "alpha.png");
  const second = await generateImageLqip(imagePath, "alpha.png");

  assert.deepEqual(first, second);
  assert.equal(first.width, 32);
  assert.equal(first.height, 16);
  assert.equal(first.hasAlpha, true);
  assert.match(first.src, /^data:image\/webp;base64,/);
  assert.ok(first.src.length <= LQIP_MAX_DATA_URI_LENGTH);
  const encoded = Buffer.from(first.src.split(",")[1], "base64");
  assert.equal((await sharp(encoded).metadata()).format, "webp");
});

test("video LQIPs use the first frame and enforce bounded geometry", async (t) => {
  assert.ok(ffmpegPath, "ffmpeg-static does not support this platform");
  await preflightFfmpeg(ffmpegPath);

  const directory = await mkdtemp(join(tmpdir(), "media-lqip-video-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const videoPath = join(directory, "sample.mp4");
  await runBinary(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=64x36:d=0.2",
    "-c:v",
    "mpeg4",
    "-pix_fmt",
    "yuv420p",
    "-y",
    videoPath,
  ]);

  const lqip = await generateVideoLqip(videoPath, "sample.mp4", {
    binaryPath: ffmpegPath,
  });
  assert.equal(lqip.width, 32);
  assert.equal(lqip.height, 18);
  assert.equal(lqip.hasAlpha, false);
  assert.match(lqip.src, /^data:image\/webp;base64,/);
});

test("video LQIP errors identify corrupt sources and timeouts", async (t) => {
  assert.ok(ffmpegPath, "ffmpeg-static does not support this platform");
  const directory = await mkdtemp(join(tmpdir(), "media-lqip-errors-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const corruptPath = join(directory, "corrupt.mp4");
  await writeFile(corruptPath, "not a video", "utf8");

  await assert.rejects(
    generateVideoLqip(corruptPath, "content/corrupt.mp4", {
      binaryPath: ffmpegPath,
    }),
    /LQIP generation failed for content\/corrupt\.mp4: FFmpeg exited/,
  );

  const hangingBinary = join(directory, "hanging-ffmpeg");
  await writeFile(hangingBinary, "#!/bin/sh\nsleep 2\n", "utf8");
  await chmod(hangingBinary, 0o755);
  await assert.rejects(
    generateVideoLqip(corruptPath, "content/slow.mp4", {
      binaryPath: hangingBinary,
      timeoutMs: 25,
    }),
    /LQIP generation failed for content\/slow\.mp4: FFmpeg timed out/,
  );
});

test("LQIP and manifest schemas reject incomplete generated artifacts", () => {
  assert.throws(() => lqipSchema.parse({ src: "https://example.com/a.webp" }));
  assert.throws(() =>
    lqipSchema.parse({
      src: `data:image/webp;base64,${"A".repeat(LQIP_MAX_DATA_URI_LENGTH)}`,
      width: 32,
      height: 32,
      hasAlpha: false,
    }),
  );
  assert.throws(() => manifestSchema.parse({ entries: {} }));
  assert.throws(() =>
    manifestSchema.parse({ schemaVersion: "1", entries: {} }),
  );
  assert.throws(() =>
    manifestSchema.parse({
      schemaVersion: "2",
      entries: {
        "src/content/media/missing.png": {
          id: "image",
          type: "image",
          width: 100,
          height: 50,
        },
      },
    }),
  );
});
