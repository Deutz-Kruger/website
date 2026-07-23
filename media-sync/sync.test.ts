import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import {
  type LegacyAuditCandidate,
  legacyCleanupResultSchema,
  type LocalMediaFile,
  type ManagedMetadata,
  MEDIA_CREATOR,
  MEDIA_SCHEMA_VERSION,
  type MediaType,
  type RemoteMedia,
} from "./schema";
import {
  auditLegacyMedia,
  cleanupLegacyMedia,
  type MediaClient,
  pruneMedia,
  readManifest,
  syncMedia,
  writeManifest,
} from "./sync";

const hash = (character: string) => character.repeat(64);
const TEST_LQIP = {
  src: "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAACwAgCdASogABAAPwFqrE6rJiQiMAgBYCAJaQAAeyAA/vDBoAA=",
  width: 32,
  height: 16,
  hasAlpha: false,
} as const;
const SQUARE_TEST_LQIP = {
  src: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoKAAoAA8BgJaQAA3AA/vS4AAA=",
  width: 10,
  height: 10,
  hasAlpha: false,
} as const;

const imageFile = (overrides?: Partial<LocalMediaFile>): LocalMediaFile => ({
  absolutePath: "/tmp/image.png",
  sourcePath: "src/content/media/image.png",
  sha256: hash("a"),
  type: "image",
  width: 100,
  height: 50,
  lqip: TEST_LQIP,
  ...overrides,
});

const metadataFor = (
  file: LocalMediaFile,
  staleSince?: string,
): ManagedMetadata => ({
  schemaVersion: MEDIA_SCHEMA_VERSION,
  sourcePath: file.sourcePath,
  sha256: file.sha256,
  ...(staleSince ? { staleSince } : {}),
});

const remoteFor = (
  file: LocalMediaFile,
  overrides?: Partial<RemoteMedia>,
): RemoteMedia => ({
  id: `remote-${file.sha256.slice(0, 4)}`,
  type: file.type,
  creator: MEDIA_CREATOR,
  filename: basename(file.sourcePath),
  uploaded: "2026-07-01T00:00:00.000Z",
  metadata: metadataFor(file),
  readyToStream: true,
  status: "ready",
  ...overrides,
});

class FakeClient implements MediaClient {
  afterDelete?: () => void;
  remote: RemoteMedia[] = [];
  deleted: RemoteMedia[] = [];
  failDeleteIds = new Set<string>();
  getRequests: Array<{ id: string; type: MediaType }> = [];
  listManagedRequests = 0;
  updates: Array<{ media: RemoteMedia; metadata: ManagedMetadata }> = [];
  uploads: LocalMediaFile[] = [];
  failUpload = false;

  async deleteMedia(media: Pick<RemoteMedia, "id" | "type">) {
    if (this.failDeleteIds.has(media.id)) throw new Error("delete failed");
    const index = this.remote.findIndex(
      (entry) => entry.id === media.id && entry.type === media.type,
    );
    if (index < 0) return;
    this.deleted.push(this.remote[index]);
    this.remote.splice(index, 1);
    this.afterDelete?.();
  }

  async getMedia(id: string, type: MediaType) {
    this.getRequests.push({ id, type });
    return (
      this.remote.find((entry) => entry.id === id && entry.type === type) ??
      null
    );
  }

  async listImages(creator?: string) {
    return this.remote.filter(
      (entry) =>
        entry.type === "image" &&
        (creator === undefined || entry.creator === creator),
    );
  }

  async listManagedMedia() {
    this.listManagedRequests += 1;
    return this.remote.filter((entry) => entry.creator === MEDIA_CREATOR);
  }

  async listVideos(creator?: string) {
    return this.remote.filter(
      (entry) =>
        entry.type === "video" &&
        (creator === undefined || entry.creator === creator),
    );
  }

  async updateMetadata(
    media: Pick<RemoteMedia, "filename" | "id" | "type">,
    metadata: ManagedMetadata,
  ) {
    const found = this.remote.find((entry) => entry.id === media.id);
    if (!found) throw new Error(`missing fake media ${media.id}`);
    found.creator = MEDIA_CREATOR;
    found.metadata = metadata;
    this.updates.push({ media: found, metadata });
  }

  async uploadImage(file: LocalMediaFile, metadata: ManagedMetadata) {
    if (this.failUpload) throw new Error("upload failed");
    this.uploads.push(file);
    const remote = remoteFor(file, {
      id: `uploaded-${file.sha256.slice(0, 4)}`,
      metadata,
    });
    this.remote.push(remote);
    return remote;
  }

  async uploadVideo(file: LocalMediaFile, metadata: ManagedMetadata) {
    if (this.failUpload) throw new Error("upload failed");
    this.uploads.push(file);
    const remote = remoteFor(file, {
      id: `uploaded-${file.sha256.slice(0, 4)}`,
      metadata,
      readyToStream: false,
      status: "queued",
    });
    this.remote.push(remote);
    return remote;
  }

  async waitForVideoReady(id: string) {
    const found = this.remote.find((entry) => entry.id === id);
    if (!found) throw new Error(`missing fake video ${id}`);
    found.readyToStream = true;
    found.status = "ready";
    return found;
  }
}

const silentLogger = { info() {}, warn() {} };

const writeAuditReport = async (
  path: string,
  candidates: LegacyAuditCandidate[],
) => {
  await writeFile(
    path,
    `${JSON.stringify(
      {
        generatedAt: "2026-07-13T00:00:00.000Z",
        candidates,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const auditCandidate = (
  id: string,
  overrides?: Partial<LegacyAuditCandidate>,
): LegacyAuditCandidate => ({
  id,
  type: "image",
  filename: "image.png",
  matchingSourcePaths: ["src/content/media/image.png"],
  ...overrides,
});

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

test("legacy audit reports matching untagged assets without mutation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-audit-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const local = imageFile();
  const client = new FakeClient();
  client.remote = [
    remoteFor(local, { creator: undefined, id: "legacy" }),
    remoteFor(local, { id: "managed" }),
  ];
  const outputPath = join(directory, "audit.json");
  const messages: string[] = [];

  const summary = await auditLegacyMedia({
    client,
    localMedia: [local],
    logger: { info: (message) => messages.push(message), warn() {} },
    outputPath,
  });

  assert.equal(summary.candidates, 1);
  const report = JSON.parse(await readFile(outputPath, "utf8")) as {
    candidates: Array<{ id: string; matchingSourcePaths: string[] }>;
  };
  assert.equal(report.candidates[0].id, "legacy");
  assert.deepEqual(report.candidates[0].matchingSourcePaths, [
    local.sourcePath,
  ]);
  assert.equal(client.deleted.length, 0);
  assert.equal(client.updates.length, 0);
  assert.match(messages.at(-1) ?? "", /sync-media:cleanup-legacy/);
});

test("legacy cleanup dry run classifies candidates without deletion", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-cleanup-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const reportPath = join(directory, "audit.json");
  const resultPath = join(directory, "result.json");
  await writeManifest(
    {
      "src/content/media/current.png": {
        id: "current",
        type: "image",
        width: 10,
        height: 10,
        lqip: SQUARE_TEST_LQIP,
      },
    },
    manifestPath,
  );
  await writeAuditReport(reportPath, [
    auditCandidate("legacy"),
    auditCandidate("current"),
    auditCandidate("tagged"),
    auditCandidate("renamed"),
    auditCandidate("missing"),
    auditCandidate("wrong-type"),
  ]);

  const local = imageFile();
  const client = new FakeClient();
  client.remote = [
    remoteFor(local, { creator: undefined, id: "legacy" }),
    remoteFor(local, { creator: undefined, id: "current" }),
    remoteFor(local, { creator: "another-app", id: "tagged" }),
    remoteFor(local, {
      creator: undefined,
      filename: "renamed.png",
      id: "renamed",
    }),
    remoteFor(local, {
      creator: undefined,
      id: "wrong-type",
      type: "video",
    }),
  ];

  const summary = await cleanupLegacyMedia({
    client,
    logger: silentLogger,
    manifestPath,
    reportPath,
    resultPath,
  });

  assert.equal(summary.eligible, 1);
  assert.equal(summary.missing, 1);
  assert.equal(summary.protected, 1);
  assert.equal(summary.tagged, 1);
  assert.equal(summary.filenameMismatches, 1);
  assert.equal(summary.typeMismatches, 1);
  assert.equal(client.deleted.length, 0);
  assert.equal(client.getRequests.length, 0);
  await assert.rejects(readFile(resultPath, "utf8"), { code: "ENOENT" });
});

test("legacy cleanup apply requires the exact report checksum", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-cleanup-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const reportPath = join(directory, "audit.json");
  const resultPath = join(directory, "result.json");
  await writeManifest({}, manifestPath);
  await writeAuditReport(reportPath, [auditCandidate("legacy")]);
  const client = new FakeClient();
  client.remote = [
    remoteFor(imageFile(), { creator: undefined, id: "legacy" }),
  ];
  const messages: string[] = [];
  const logger = {
    info: (message: string) => messages.push(message),
    warn() {},
  };

  const dryRun = await cleanupLegacyMedia({
    client,
    logger,
    manifestPath,
    reportPath,
  });
  await assert.rejects(
    cleanupLegacyMedia({
      apply: true,
      client,
      logger,
      manifestPath,
      reportPath,
      resultPath,
    }),
    /requires --report-sha256/,
  );
  await assert.rejects(
    cleanupLegacyMedia({
      apply: true,
      client,
      expectedReportSha256: hash("f"),
      logger,
      manifestPath,
      reportPath,
      resultPath,
    }),
    /checksum mismatch/,
  );

  const applied = await cleanupLegacyMedia({
    apply: true,
    client,
    expectedReportSha256: dryRun.reportSha256,
    logger,
    manifestPath,
    reportPath,
    resultPath,
  });

  assert.equal(applied.deleted, 1);
  assert.deepEqual(
    client.deleted.map((media) => media.id),
    ["legacy"],
  );
  assert.deepEqual(client.getRequests, [{ id: "legacy", type: "image" }]);
  assert.ok(messages.some((message) => message.includes("Ctrl+C once")));
  assert.ok(
    messages.some((message) => message.includes("Progress 1/1 | deleted 1")),
  );
  const checkpoint = legacyCleanupResultSchema.parse(
    JSON.parse(await readFile(resultPath, "utf8")),
  );
  assert.equal(checkpoint.results[0].status, "deleted");
});

test("legacy cleanup checkpoints partial failures and resumes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-cleanup-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const reportPath = join(directory, "audit.json");
  const resultPath = join(directory, "result.json");
  await writeManifest({}, manifestPath);
  await writeAuditReport(reportPath, [
    auditCandidate("legacy-a"),
    auditCandidate("legacy-b"),
  ]);
  const client = new FakeClient();
  client.remote = [
    remoteFor(imageFile(), { creator: undefined, id: "legacy-a" }),
    remoteFor(imageFile(), { creator: undefined, id: "legacy-b" }),
  ];
  const dryRun = await cleanupLegacyMedia({
    client,
    logger: silentLogger,
    manifestPath,
    reportPath,
  });
  client.failDeleteIds.add("legacy-b");

  await assert.rejects(
    cleanupLegacyMedia({
      apply: true,
      checkpointBatchSize: 2,
      client,
      deleteConcurrency: 2,
      expectedReportSha256: dryRun.reportSha256,
      logger: silentLogger,
      manifestPath,
      reportPath,
      resultPath,
    }),
    /rerun the same command to resume/,
  );
  const partial = legacyCleanupResultSchema.parse(
    JSON.parse(await readFile(resultPath, "utf8")),
  );
  assert.deepEqual(
    partial.results.map((result) => [result.id, result.status]),
    [
      ["legacy-a", "deleted"],
      ["legacy-b", "failed"],
    ],
  );

  client.failDeleteIds.clear();
  const resumed = await cleanupLegacyMedia({
    apply: true,
    checkpointBatchSize: 2,
    client,
    deleteConcurrency: 2,
    expectedReportSha256: dryRun.reportSha256,
    logger: silentLogger,
    manifestPath,
    reportPath,
    resultPath,
  });

  assert.equal(resumed.failed, 0);
  assert.equal(resumed.deleted, 2);
  assert.deepEqual(client.deleted.map((media) => media.id).sort(), [
    "legacy-a",
    "legacy-b",
  ]);
});

test("legacy cleanup pauses gracefully, summarizes, and resumes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "media-cleanup-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const manifestPath = join(directory, "manifest.json");
  const reportPath = join(directory, "audit.json");
  const resultPath = join(directory, "result.json");
  await writeManifest({}, manifestPath);
  await writeAuditReport(reportPath, [
    auditCandidate("legacy-a"),
    auditCandidate("legacy-b"),
    auditCandidate("legacy-c"),
  ]);
  const client = new FakeClient();
  client.remote = [
    remoteFor(imageFile(), { creator: undefined, id: "legacy-a" }),
    remoteFor(imageFile(), { creator: undefined, id: "legacy-b" }),
    remoteFor(imageFile(), { creator: undefined, id: "legacy-c" }),
  ];
  const dryRun = await cleanupLegacyMedia({
    client,
    logger: silentLogger,
    manifestPath,
    reportPath,
  });
  const controller = new AbortController();
  client.afterDelete = () => controller.abort();
  const messages: string[] = [];
  const logger = {
    info: (message: string) => messages.push(message),
    warn() {},
  };

  const paused = await cleanupLegacyMedia({
    apply: true,
    checkpointBatchSize: 3,
    client,
    deleteConcurrency: 1,
    expectedReportSha256: dryRun.reportSha256,
    logger,
    manifestPath,
    reportPath,
    resultPath,
    signal: controller.signal,
  });

  assert.equal(paused.paused, true);
  assert.equal(paused.deleted, 1);
  assert.equal(paused.processed, 1);
  assert.equal(paused.remaining, 2);
  assert.ok(
    messages.some(
      (message) =>
        message.includes("Legacy cleanup paused safely") &&
        message.includes("Processed   1"),
    ),
  );
  const checkpoint = legacyCleanupResultSchema.parse(
    JSON.parse(await readFile(resultPath, "utf8")),
  );
  assert.equal(checkpoint.results.length, 1);

  client.afterDelete = undefined;
  const resumed = await cleanupLegacyMedia({
    apply: true,
    checkpointBatchSize: 3,
    client,
    deleteConcurrency: 1,
    expectedReportSha256: dryRun.reportSha256,
    logger: silentLogger,
    manifestPath,
    reportPath,
    resultPath,
  });

  assert.equal(resumed.paused, false);
  assert.equal(resumed.deleted, 3);
  assert.equal(resumed.remaining, 0);
});
