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

test("video LQIP timeout rejects promptly when a descendant holds the pipes open", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-lqip-pipes-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  // The background sleep inherits stdout/stderr and outlives the wrapper,
  // so only killing the process tree (and closing the pipes) rejects promptly.
  const wrapper = join(directory, "pipe-holding-ffmpeg");
  await writeFile(wrapper, "#!/bin/sh\nsleep 30 &\nsleep 30\n", "utf8");
  await chmod(wrapper, 0o755);

  const startedAt = Date.now();
  await assert.rejects(
    generateVideoLqip("unused.mp4", "content/pipe-hold.mp4", {
      binaryPath: wrapper,
      timeoutMs: 100,
    }),
    /LQIP generation failed for content\/pipe-hold\.mp4: FFmpeg timed out after 100ms/,
  );
  assert.ok(
    Date.now() - startedAt < 15_000,
    "timeout must reject without waiting for the pipe-holding descendant",
  );
});

test("video LQIP treats a zero timeout as an immediate timeout", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-lqip-zero-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const hangingBinary = join(directory, "hanging-ffmpeg");
  await writeFile(hangingBinary, "#!/bin/sh\nsleep 30\n", "utf8");
  await chmod(hangingBinary, 0o755);

  await assert.rejects(
    generateVideoLqip("unused.mp4", "content/zero-timeout.mp4", {
      binaryPath: hangingBinary,
      timeoutMs: 0,
    }),
    /FFmpeg timed out after 1ms/,
  );
});

test("video LQIP tolerates noisy stderr on success and bounds it in errors", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-lqip-noise-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const framePath = join(directory, "frame.png");
  await sharp({
    create: {
      width: 64,
      height: 32,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toFile(framePath);

  // 2 MiB of stderr must not terminate a successful extraction.
  const noisySuccess = join(directory, "noisy-success");
  await writeFile(
    noisySuccess,
    `#!/bin/sh\nhead -c 2097152 /dev/zero | tr '\\0' 'x' >&2\ncat '${framePath}'\n`,
    "utf8",
  );
  await chmod(noisySuccess, 0o755);
  const lqip = await generateVideoLqip("unused.mp4", "content/noisy.mp4", {
    binaryPath: noisySuccess,
    timeoutMs: 10_000,
  });
  assert.equal(lqip.width, 32);
  assert.equal(lqip.height, 16);
  assert.match(lqip.src, /^data:image\/webp;base64,/);

  // A nonzero exit still reports bounded diagnostics.
  const noisyFailure = join(directory, "noisy-failure");
  await writeFile(
    noisyFailure,
    "#!/bin/sh\nhead -c 2097152 /dev/zero | tr '\\0' 'x' >&2\nexit 3\n",
    "utf8",
  );
  await chmod(noisyFailure, 0o755);
  const error: Error = await generateVideoLqip(
    "unused.mp4",
    "content/noisy-fail.mp4",
    { binaryPath: noisyFailure, timeoutMs: 10_000 },
  ).then(
    () => assert.fail("expected noisy failure to reject"),
    (cause: unknown) => cause as Error,
  );
  assert.match(error.message, /FFmpeg exited with 3/);
  assert.ok(
    error.message.length < 66_000,
    "stderr diagnostics in the error stay bounded",
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
