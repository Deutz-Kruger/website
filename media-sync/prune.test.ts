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
