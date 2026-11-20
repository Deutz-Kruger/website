import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeManifest } from "./manifest";
import { pruneMedia } from "./prune";
import {
  FakeClient,
  hash,
  imageFile,
  metadataFor,
  remoteFor,
  silentLogger,
  TEST_LQIP,
} from "./test-support";

test("prune marks, retains, deletes, and isolates managed media", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-prune-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const current = imageFile();
  await writeManifest(
    {
      [current.sourcePath]: {
        id: "current",
        type: "image",
        width: current.width,
        height: current.height,
        lqip: TEST_LQIP,
      },
    },
    manifestPath,
  );
  const client = new FakeClient();
  client.remote = [
    remoteFor(current, {
      id: "current",
      metadata: metadataFor(current, "2026-06-01T00:00:00.000Z"),
    }),
    remoteFor(imageFile({ sha256: hash("b") }), { id: "new-stale" }),
    remoteFor(imageFile({ sha256: hash("c") }), {
      id: "recent-stale",
      metadata: metadataFor(
        imageFile({ sha256: hash("c") }),
        "2026-07-09T00:00:00.000Z",
      ),
    }),
    remoteFor(imageFile({ sha256: hash("d") }), {
      id: "expired-stale",
      metadata: metadataFor(
        imageFile({ sha256: hash("d") }),
        "2026-07-01T00:00:00.000Z",
      ),
    }),
    remoteFor(imageFile({ sha256: hash("e") }), {
      id: "malformed",
      metadata: { sourcePath: current.sourcePath },
    }),
  ];

  const summary = await pruneMedia({
    client,
    logger: silentLogger,
    manifestPath,
    now: new Date("2026-07-13T00:00:00.000Z"),
  });

  assert.deepEqual(summary, {
    kept: 1,
    markedStale: 1,
    retainedStale: 1,
    deleted: 1,
    skipped: 1,
  });
  assert.deepEqual(
    client.deleted.map((media) => media.id),
    ["expired-stale"],
  );
  assert.deepEqual(client.updates.map((update) => update.media.id).sort(), [
    "current",
    "new-stale",
  ]);
});

test("prune keep path clears staleSince while preserving the asset identity", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-prune-keep-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const current = imageFile();
  await writeManifest(
    {
      [current.sourcePath]: {
        id: "current",
        type: "image",
        width: current.width,
        height: current.height,
        lqip: TEST_LQIP,
      },
    },
    manifestPath,
  );
  const staleSince = "2026-06-01T00:00:00.000Z";
  const client = new FakeClient();
  client.remote = [
    remoteFor(current, {
      id: "current",
      metadata: metadataFor(current, staleSince),
    }),
  ];

  const summary = await pruneMedia({
    client,
    logger: silentLogger,
    manifestPath,
    now: new Date("2026-07-13T00:00:00.000Z"),
  });

  assert.equal(summary.kept, 1);
  assert.equal(client.updates.length, 1);
  const update = client.updates[0];
  assert.equal(update.media.id, "current");
  assert.equal(update.metadata.staleSince, undefined);
  assert.equal(update.metadata.sourcePath, current.sourcePath);
  assert.equal(update.metadata.sha256, current.sha256);
});

test("prune dry run leaves a kept asset's stale marker untouched", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-prune-dry-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const current = imageFile();
  await writeManifest(
    {
      [current.sourcePath]: {
        id: "current",
        type: "image",
        width: current.width,
        height: current.height,
        lqip: TEST_LQIP,
      },
    },
    manifestPath,
  );
  const staleSince = "2026-06-01T00:00:00.000Z";
  const client = new FakeClient();
  client.remote = [
    remoteFor(current, {
      id: "current",
      metadata: metadataFor(current, staleSince),
    }),
  ];

  const summary = await pruneMedia({
    client,
    dryRun: true,
    logger: silentLogger,
    manifestPath,
    now: new Date("2026-07-13T00:00:00.000Z"),
  });

  assert.equal(summary.kept, 1);
  assert.equal(client.updates.length, 0);
  assert.equal(
    (client.remote[0].metadata as { staleSince?: string }).staleSince,
    staleSince,
    "dry run must not send an update or clear the marker",
  );
});
