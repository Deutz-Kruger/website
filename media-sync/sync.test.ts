import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readManifest, writeManifest } from "./manifest";
import type { LocalMediaFile } from "./schema";
import { syncMedia } from "./sync";
import {
  FakeClient,
  hash,
  imageFile,
  remoteFor,
  silentLogger,
  SQUARE_TEST_LQIP,
  TEST_LQIP,
} from "./test-support";

test("unchanged sync reuses remote asset and writes complete manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const local = imageFile();
  const client = new FakeClient();
  client.remote = [remoteFor(local)];

  const summary = await syncMedia({
    client,
    localMedia: [local],
    logger: silentLogger,
    manifestPath,
  });

  assert.equal(summary.reused, 1);
  assert.equal(summary.uploaded, 0);
  assert.equal(client.uploads.length, 0);
  assert.deepEqual(await readManifest(manifestPath), {
    schemaVersion: "2",
    entries: {
      [local.sourcePath]: {
        id: client.remote[0].id,
        type: "image",
        width: 100,
        height: 50,
        lqip: TEST_LQIP,
      },
    },
  });
});

test("manifest output is versioned and deterministically ordered", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-manifest-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const entry = {
    id: "image-id",
    type: "image" as const,
    width: 100,
    height: 50,
    lqip: TEST_LQIP,
  };

  await writeManifest(
    {
      "src/content/media/z.png": entry,
      "src/content/media/a.png": entry,
    },
    manifestPath,
  );

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, "2");
  assert.deepEqual(Object.keys(manifest.entries), [
    "src/content/media/a.png",
    "src/content/media/z.png",
  ]);
});

test("outdated manifests fail with a sync recovery instruction", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-manifest-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  await writeFile(manifestPath, '{"src/content/media/image.png":{}}', "utf8");

  await assert.rejects(
    readManifest(manifestPath),
    /manifest is invalid or outdated.*pnpm sync-media/i,
  );
});

test("changed file uploads once without deleting previous asset", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const oldFile = imageFile();
  const changedFile = imageFile({ sha256: hash("b") });
  const client = new FakeClient();
  client.remote = [remoteFor(oldFile)];

  const summary = await syncMedia({
    client,
    localMedia: [changedFile],
    logger: silentLogger,
    manifestPath: join(directory, "manifest.json"),
  });

  assert.equal(summary.uploaded, 1);
  assert.equal(client.uploads.length, 1);
  assert.equal(client.deleted.length, 0);
});

test("renamed file uploads under its new source identity", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const oldFile = imageFile();
  const renamedFile = imageFile({
    sourcePath: "src/content/media/renamed.png",
  });
  const client = new FakeClient();
  client.remote = [remoteFor(oldFile)];

  const summary = await syncMedia({
    client,
    localMedia: [renamedFile],
    logger: silentLogger,
    manifestPath: join(directory, "manifest.json"),
  });

  assert.equal(summary.uploaded, 1);
  assert.equal(client.deleted.length, 0);
});

test("matching metadata with wrong provider type is never reused", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const local = imageFile();
  const client = new FakeClient();
  client.remote = [remoteFor(local, { type: "video" })];

  const summary = await syncMedia({
    client,
    localMedia: [local],
    logger: silentLogger,
    manifestPath: join(directory, "manifest.json"),
  });

  assert.equal(summary.uploaded, 1);
  assert.equal(summary.reused, 0);
});

test("failed upload preserves previous manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  await writeManifest(
    {
      "src/content/media/old.png": {
        id: "old-id",
        type: "image",
        width: 10,
        height: 10,
        lqip: SQUARE_TEST_LQIP,
      },
    },
    manifestPath,
  );
  const before = await readFile(manifestPath, "utf8");
  const client = new FakeClient();
  client.failUpload = true;

  await assert.rejects(
    syncMedia({
      client,
      localMedia: [imageFile({ sha256: hash("c") })],
      logger: silentLogger,
      manifestPath,
    }),
    /upload failed/,
  );
  assert.equal(await readFile(manifestPath, "utf8"), before);
  assert.equal(client.deleted.length, 0);
});

test("invalid LQIP aborts before Cloudflare access and preserves manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  await writeManifest(
    {
      "src/content/media/old.png": {
        id: "old-id",
        type: "image",
        width: 100,
        height: 50,
        lqip: TEST_LQIP,
      },
    },
    manifestPath,
  );
  const before = await readFile(manifestPath, "utf8");
  const client = new FakeClient();
  const invalidFile = {
    ...imageFile(),
    lqip: { ...TEST_LQIP, src: "https://example.com/placeholder.webp" },
  } as unknown as LocalMediaFile;

  await assert.rejects(
    syncMedia({
      client,
      localMedia: [invalidFile],
      logger: silentLogger,
      manifestPath,
    }),
  );
  assert.equal(client.listManagedRequests, 0);
  assert.equal(client.uploads.length, 0);
  assert.equal(client.updates.length, 0);
  assert.equal(await readFile(manifestPath, "utf8"), before);
});

test("interrupted processing video is waited for and reused", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const video = imageFile({
    absolutePath: "/tmp/video.mp4",
    sourcePath: "src/content/media/video.mp4",
    type: "video",
  });
  const client = new FakeClient();
  client.remote = [
    remoteFor(video, { readyToStream: false, status: "inprogress" }),
  ];

  const summary = await syncMedia({
    client,
    localMedia: [video],
    logger: silentLogger,
    manifestPath: join(directory, "manifest.json"),
  });

  assert.equal(summary.waiting, 1);
  assert.equal(summary.reused, 1);
  assert.equal(summary.uploaded, 0);
});

test("dry run reports upload without writing manifest", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-sync-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const summary = await syncMedia({
    client: new FakeClient(),
    dryRun: true,
    localMedia: [imageFile()],
    logger: silentLogger,
    manifestPath,
  });

  assert.equal(summary.plannedUploads, 1);
  await assert.rejects(readFile(manifestPath, "utf8"), { code: "ENOENT" });
});

test("deployment sync refuses an unexpectedly empty managed inventory", async () => {
  await assert.rejects(
    syncMedia({
      client: new FakeClient(),
      localMedia: [imageFile()],
      logger: silentLogger,
      requireExistingInventory: true,
    }),
    /No managed Cloudflare inventory found/,
  );
});
