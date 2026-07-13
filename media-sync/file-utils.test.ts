import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { generateSha256, scanLocalMedia } from "./file-utils";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("SHA-256 hashing is deterministic", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-hash-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const filePath = join(directory, "file.txt");
  await writeFile(filePath, "abc", "utf8");
  assert.equal(
    await generateSha256(filePath),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("media scan ignores dotfiles and extracts image dimensions", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-scan-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const mediaRoot = join(directory, "src/content/media");
  await mkdir(mediaRoot, { recursive: true });
  await writeFile(join(mediaRoot, ".gitkeep"), "", "utf8");
  await writeFile(join(mediaRoot, "pixel.png"), onePixelPng, "base64");

  const files = await scanLocalMedia({ mediaRoot, projectRoot: directory });
  assert.equal(files.length, 1);
  assert.equal(files[0].sourcePath, "src/content/media/pixel.png");
  assert.equal(files[0].width, 1);
  assert.equal(files[0].height, 1);
});

test("media scan rejects unsupported visible files", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-scan-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const mediaRoot = join(directory, "media");
  await mkdir(mediaRoot, { recursive: true });
  await writeFile(join(mediaRoot, "notes.txt"), "nope", "utf8");

  await assert.rejects(
    scanLocalMedia({ mediaRoot, projectRoot: directory }),
    /Unsupported files in media directory/,
  );
});
