import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

import {
  DEFAULT_MEDIA_ROOT,
  DEFAULT_PROJECT_ROOT,
  getLegacyRemoteNames,
  mapConcurrent,
  scanLocalMedia,
} from "./file-utils";
import {
  type LegacyAuditCandidate,
  legacyAuditReportSchema,
  type LegacyCleanupResult,
  type LegacyCleanupResultItem,
  legacyCleanupResultSchema,
  type LocalMediaFile,
  type ManagedMetadata,
  managedMetadataSchema,
  type Manifest,
  type ManifestEntry,
  manifestSchema,
  MEDIA_CREATOR,
  MEDIA_SCHEMA_VERSION,
  type MediaType,
  type RemoteMedia,
} from "./schema";

export const DEFAULT_MANIFEST_PATH = resolve(
  "./src/generated/media-manifest.json",
);
export const DEFAULT_AUDIT_PATH = resolve(
  "./media-sync/legacy-media-audit.json",
);
export const DEFAULT_CLEANUP_RESULT_PREFIX = resolve(
  "./media-sync/legacy-media-cleanup",
);

const STALE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_VIDEO_STATES = new Set(["downloading", "inprogress", "queued"]);

export interface SyncLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface MediaClient {
  deleteMedia(media: Pick<RemoteMedia, "id" | "type">): Promise<void>;
  getMedia(id: string, type: MediaType): Promise<RemoteMedia | null>;
  listImages(creator?: string): Promise<RemoteMedia[]>;
  listManagedMedia(): Promise<RemoteMedia[]>;
  listVideos(creator?: string): Promise<RemoteMedia[]>;
  updateMetadata(
    media: Pick<RemoteMedia, "filename" | "id" | "type">,
    metadata: ManagedMetadata,
  ): Promise<void>;
  uploadImage(
    file: LocalMediaFile,
    metadata: ManagedMetadata,
  ): Promise<RemoteMedia>;
  uploadVideo(
    file: LocalMediaFile,
    metadata: ManagedMetadata,
  ): Promise<RemoteMedia>;
  waitForVideoReady(id: string): Promise<RemoteMedia>;
}

export interface SyncOptions {
  client: MediaClient;
  dryRun?: boolean;
  localMedia?: LocalMediaFile[];
  logger?: SyncLogger;
  manifestPath?: string;
  mediaRoot?: string;
  projectRoot?: string;
  requireExistingInventory?: boolean;
}

export interface SyncSummary {
  local: number;
  reused: number;
  uploaded: number;
  waiting: number;
  staleMarkersCleared: number;
  plannedUploads: number;
}

export interface PruneOptions {
  client: MediaClient;
  dryRun?: boolean;
  logger?: SyncLogger;
  manifestPath?: string;
  now?: Date;
}

export interface PruneSummary {
  kept: number;
  markedStale: number;
  retainedStale: number;
  deleted: number;
  skipped: number;
}

export interface CleanupLegacyOptions {
  apply?: boolean;
  checkpointBatchSize?: number;
  client: MediaClient;
  deleteConcurrency?: number;
  expectedReportSha256?: string;
  logger?: SyncLogger;
  manifestPath?: string;
  reportPath?: string;
  resultPath?: string;
  signal?: AbortSignal;
}

export interface CleanupLegacySummary {
  candidates: number;
  deleted: number;
  eligible: number;
  failed: number;
  filenameMismatches: number;
  missing: number;
  paused: boolean;
  processed: number;
  protected: number;
  remaining: number;
  reportSha256: string;
  resultPath?: string;
  tagged: number;
  typeMismatches: number;
}

const defaultLogger: SyncLogger = {
  info: console.log,
  warn: console.warn,
};

const getMetadata = (media: RemoteMedia): ManagedMetadata | undefined => {
  const parsed = managedMetadataSchema.safeParse(media.metadata);
  return parsed.success ? parsed.data : undefined;
};

const createMetadata = (
  file: LocalMediaFile,
  staleSince?: string,
): ManagedMetadata => ({
  schemaVersion: MEDIA_SCHEMA_VERSION,
  sourcePath: file.sourcePath,
  sha256: file.sha256,
  ...(staleSince ? { staleSince } : {}),
});

const metadataKey = (sourcePath: string, sha256: string) =>
  `${sourcePath}\0${sha256}`;

const isReady = (media: RemoteMedia) =>
  media.type === "image" ||
  media.readyToStream === true ||
  media.status === "ready";

const newestFirst = (a: RemoteMedia, b: RemoteMedia) =>
  (b.uploaded ?? "").localeCompare(a.uploaded ?? "");

const toManifestEntry = (
  file: LocalMediaFile,
  remote: RemoteMedia,
): ManifestEntry => ({
  id: remote.id,
  type: file.type,
  width: file.width,
  height: file.height,
});

const sortManifest = (manifest: Manifest): Manifest =>
  Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );

const writeJsonAtomic = async (path: string, value: unknown): Promise<void> => {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
};

/** Writes a generated manifest atomically to avoid partial builds. */
export const writeManifest = async (
  manifest: Manifest,
  manifestPath = DEFAULT_MANIFEST_PATH,
): Promise<void> => {
  const parsed = manifestSchema.parse(sortManifest(manifest));
  await writeJsonAtomic(manifestPath, parsed);
};

/** Reads and validates the generated frontend manifest. */
export const readManifest = async (
  manifestPath = DEFAULT_MANIFEST_PATH,
): Promise<Manifest> => {
  const contents = await readFile(manifestPath, "utf8");
  return manifestSchema.parse(JSON.parse(contents));
};

const buildRemoteIndex = (remoteMedia: RemoteMedia[]) => {
  const index = new Map<string, RemoteMedia[]>();
  for (const media of remoteMedia) {
    const metadata = getMetadata(media);
    if (!metadata) continue;
    const key = metadataKey(metadata.sourcePath, metadata.sha256);
    const entries = index.get(key) ?? [];
    entries.push(media);
    index.set(key, entries);
  }
  for (const entries of index.values()) entries.sort(newestFirst);
  return index;
};

const resolveExistingMedia = async (
  file: LocalMediaFile,
  candidates: RemoteMedia[],
  options: SyncOptions,
  summary: SyncSummary,
): Promise<RemoteMedia | undefined> => {
  const ready = candidates.find(isReady);
  if (ready) {
    const metadata = getMetadata(ready);
    if (metadata?.staleSince) {
      summary.staleMarkersCleared += 1;
      if (!options.dryRun) {
        await options.client.updateMetadata(ready, createMetadata(file));
      }
    }
    summary.reused += 1;
    return ready;
  }

  const processing = candidates.find(
    (candidate) =>
      candidate.type === "video" &&
      candidate.status !== undefined &&
      ACTIVE_VIDEO_STATES.has(candidate.status),
  );
  if (!processing || options.dryRun) return undefined;

  summary.waiting += 1;
  const resolved = await options.client.waitForVideoReady(processing.id);
  summary.reused += 1;
  return resolved;
};

/** Reconciles local media with tagged Cloudflare assets without deleting anything. */
export const syncMedia = async (options: SyncOptions): Promise<SyncSummary> => {
  const logger = options.logger ?? defaultLogger;
  const localMedia =
    options.localMedia ??
    (await scanLocalMedia({
      mediaRoot: options.mediaRoot ?? DEFAULT_MEDIA_ROOT,
      projectRoot: options.projectRoot ?? DEFAULT_PROJECT_ROOT,
    }));
  const remoteMedia = await options.client.listManagedMedia();
  if (
    options.requireExistingInventory &&
    localMedia.length > 0 &&
    remoteMedia.length === 0
  ) {
    throw new Error(
      'No managed Cloudflare inventory found. Refusing an accidental full upload; pass "--allow-empty-inventory" only for a deliberate fresh start.',
    );
  }
  const remoteIndex = buildRemoteIndex(remoteMedia);
  const summary: SyncSummary = {
    local: localMedia.length,
    reused: 0,
    uploaded: 0,
    waiting: 0,
    staleMarkersCleared: 0,
    plannedUploads: 0,
  };

  const resolvedEntries = await mapConcurrent(
    localMedia,
    3,
    async (file): Promise<[string, ManifestEntry] | undefined> => {
      const candidates = remoteIndex
        .get(metadataKey(file.sourcePath, file.sha256))
        ?.filter((candidate) => candidate.type === file.type);
      const existing = candidates?.length
        ? await resolveExistingMedia(file, candidates, options, summary)
        : undefined;
      if (existing) {
        logger.info(`reuse ${file.sourcePath}`);
        return [file.sourcePath, toManifestEntry(file, existing)];
      }

      summary.plannedUploads += 1;
      if (options.dryRun) {
        logger.info(`upload planned ${file.sourcePath}`);
        return undefined;
      }

      logger.info(`upload ${file.sourcePath}`);
      const metadata = createMetadata(file);
      let uploaded =
        file.type === "image"
          ? await options.client.uploadImage(file, metadata)
          : await options.client.uploadVideo(file, metadata);
      if (file.type === "video") {
        summary.waiting += 1;
        uploaded = await options.client.waitForVideoReady(uploaded.id);
      }
      summary.uploaded += 1;
      return [file.sourcePath, toManifestEntry(file, uploaded)];
    },
  );

  if (!options.dryRun) {
    const entries = resolvedEntries.filter(
      (entry): entry is [string, ManifestEntry] => entry !== undefined,
    );
    if (entries.length !== localMedia.length) {
      throw new Error(
        `Refusing incomplete manifest: ${entries.length}/${localMedia.length} media resolved`,
      );
    }
    await writeManifest(
      Object.fromEntries(entries),
      options.manifestPath ?? DEFAULT_MANIFEST_PATH,
    );
  }

  logger.info(
    `sync complete: ${summary.reused} reused, ${summary.uploaded} uploaded, ${summary.plannedUploads} planned`,
  );
  return summary;
};

/** Marks or deletes stale managed media after a successful deployment. */
export const pruneMedia = async (
  options: PruneOptions,
): Promise<PruneSummary> => {
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? new Date();
  const manifest = await readManifest(
    options.manifestPath ?? DEFAULT_MANIFEST_PATH,
  );
  const keepIds = new Set(Object.values(manifest).map((entry) => entry.id));
  const remoteMedia = await options.client.listManagedMedia();
  const summary: PruneSummary = {
    kept: 0,
    markedStale: 0,
    retainedStale: 0,
    deleted: 0,
    skipped: 0,
  };

  for (const media of remoteMedia) {
    const metadata = getMetadata(media);
    if (!metadata || media.creator !== MEDIA_CREATOR) {
      summary.skipped += 1;
      logger.warn(`skip unmanaged metadata ${media.type}:${media.id}`);
      continue;
    }

    if (keepIds.has(media.id)) {
      summary.kept += 1;
      if (metadata.staleSince && !options.dryRun) {
        await options.client.updateMetadata(media, {
          ...metadata,
          staleSince: undefined,
        });
      }
      continue;
    }

    if (!metadata.staleSince) {
      summary.markedStale += 1;
      logger.info(`mark stale ${media.type}:${media.id}`);
      if (!options.dryRun) {
        await options.client.updateMetadata(media, {
          ...metadata,
          staleSince: now.toISOString(),
        });
      }
      continue;
    }

    const staleFor = now.getTime() - new Date(metadata.staleSince).getTime();
    if (staleFor < STALE_RETENTION_MS) {
      summary.retainedStale += 1;
      continue;
    }

    summary.deleted += 1;
    logger.info(`delete stale ${media.type}:${media.id}`);
    if (!options.dryRun) await options.client.deleteMedia(media);
  }

  logger.info(
    `prune complete: ${summary.kept} kept, ${summary.markedStale} marked, ${summary.retainedStale} retained, ${summary.deleted} deleted, ${summary.skipped} skipped`,
  );
  return summary;
};

const getRemoteName = (media: RemoteMedia) => media.filename ?? "";

/** Writes a report of untagged Cloudflare media that may be legacy duplicates. */
export const auditLegacyMedia = async (options: {
  client: MediaClient;
  localMedia?: LocalMediaFile[];
  logger?: SyncLogger;
  mediaRoot?: string;
  outputPath?: string;
  projectRoot?: string;
}): Promise<{ candidates: number; outputPath: string }> => {
  const logger = options.logger ?? defaultLogger;
  const [scannedMedia, images, videos] = await Promise.all([
    options.localMedia ??
      scanLocalMedia({
        mediaRoot: options.mediaRoot ?? DEFAULT_MEDIA_ROOT,
        projectRoot: options.projectRoot ?? DEFAULT_PROJECT_ROOT,
      }),
    options.client.listImages(),
    options.client.listVideos(),
  ]);
  const localNames = new Map<string, string[]>();
  for (const file of scannedMedia) {
    for (const name of getLegacyRemoteNames(file.sourcePath)) {
      const paths = localNames.get(name) ?? [];
      paths.push(file.sourcePath);
      localNames.set(name, paths);
    }
  }

  const candidates = [...images, ...videos]
    .filter((media) => media.creator === undefined)
    .map((media) => ({
      id: media.id,
      type: media.type,
      filename: getRemoteName(media),
      uploaded: media.uploaded,
      matchingSourcePaths: localNames.get(getRemoteName(media)) ?? [],
    }))
    .filter((entry) => entry.matchingSourcePaths.length > 0)
    .sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));

  const outputPath = options.outputPath ?? DEFAULT_AUDIT_PATH;
  const report = legacyAuditReportSchema.parse({
    generatedAt: new Date().toISOString(),
    candidates,
  });
  await writeJsonAtomic(outputPath, report);
  logger.info(`legacy audit: ${candidates.length} candidates in ${outputPath}`);
  logger.info(
    "next: run pnpm sync-media:cleanup-legacy to validate candidates and print the report sha256",
  );
  return { candidates: candidates.length, outputPath };
};

type CleanupClassification =
  | "eligible"
  | Exclude<LegacyCleanupResultItem["status"], "deleted" | "failed">;

interface ClassifiedLegacyCandidate {
  candidate: LegacyAuditCandidate;
  classification: CleanupClassification;
}

const cleanupKey = (value: Pick<LegacyAuditCandidate, "id" | "type">) =>
  `${value.type}\0${value.id}`;

const isErrorWithCode = (error: unknown): error is { code: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string";

const readLegacyAuditReport = async (reportPath: string) => {
  const contents = await readFile(reportPath, "utf8");
  const report = legacyAuditReportSchema.parse(JSON.parse(contents));
  const reportSha256 = createHash("sha256").update(contents).digest("hex");

  const seen = new Set<string>();
  for (const candidate of report.candidates) {
    const key = cleanupKey(candidate);
    if (seen.has(key)) {
      throw new Error(
        `Legacy audit report contains duplicate candidate ${candidate.type}:${candidate.id}`,
      );
    }
    seen.add(key);
  }

  return { report, reportSha256 };
};

const readCleanupResult = async (
  resultPath: string,
  reportSha256: string,
): Promise<LegacyCleanupResult | undefined> => {
  try {
    const result = legacyCleanupResultSchema.parse(
      JSON.parse(await readFile(resultPath, "utf8")),
    );
    if (result.reportSha256 !== reportSha256) {
      throw new Error(
        `Cleanup checkpoint belongs to a different audit report: ${resultPath}`,
      );
    }
    return result;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
};

const writeCleanupResult = async (
  resultPath: string,
  reportGeneratedAt: string,
  reportSha256: string,
  results: Map<string, LegacyCleanupResultItem>,
): Promise<void> => {
  const result = legacyCleanupResultSchema.parse({
    schemaVersion: "1",
    reportSha256,
    reportGeneratedAt,
    updatedAt: new Date().toISOString(),
    results: [...results.values()].sort(
      (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
    ),
  });
  await writeJsonAtomic(resultPath, result);
};

const classifyLegacyCandidates = (
  candidates: LegacyAuditCandidate[],
  remoteMedia: RemoteMedia[],
  protectedIds: Set<string>,
): ClassifiedLegacyCandidate[] => {
  const remoteByKey = new Map(
    remoteMedia.map((media) => [cleanupKey(media), media]),
  );
  const remoteIds = new Set(remoteMedia.map((media) => media.id));

  return candidates.map((candidate) => {
    if (protectedIds.has(candidate.id)) {
      return { candidate, classification: "protected" };
    }

    const remote = remoteByKey.get(cleanupKey(candidate));
    if (!remote) {
      return {
        candidate,
        classification: remoteIds.has(candidate.id)
          ? "type-mismatch"
          : "missing",
      };
    }
    if (remote.creator !== undefined) {
      return { candidate, classification: "tagged" };
    }
    if (remote.filename !== candidate.filename) {
      return { candidate, classification: "filename-mismatch" };
    }
    return { candidate, classification: "eligible" };
  });
};

const resultItem = (
  candidate: LegacyAuditCandidate,
  status: LegacyCleanupResultItem["status"],
  message?: string,
): LegacyCleanupResultItem => ({
  id: candidate.id,
  type: candidate.type,
  status,
  ...(message ? { message } : {}),
});

const formatCount = (value: number) => value.toLocaleString("en-US");

const formatRows = (rows: Array<[string, string | number]>) => {
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  return rows
    .map(
      ([label, value]) =>
        `  ${label.padEnd(labelWidth)}  ${typeof value === "number" ? formatCount(value) : value}`,
    )
    .join("\n");
};

const displayPath = (path: string) => {
  const relativePath = relative(process.cwd(), path);
  return relativePath.split(sep)[0] === ".." ? path : relativePath || ".";
};

const skippedCount = (summary: CleanupLegacySummary) =>
  summary.protected +
  summary.tagged +
  summary.filenameMismatches +
  summary.typeMismatches;

const summarizeCleanup = (
  classified: ClassifiedLegacyCandidate[],
  reportSha256: string,
  results?: Map<string, LegacyCleanupResultItem>,
  resultPath?: string,
  paused = false,
): CleanupLegacySummary => {
  const classificationCount = (classification: CleanupClassification) =>
    classified.filter((entry) => entry.classification === classification)
      .length;
  const resultCount = (status: LegacyCleanupResultItem["status"]) =>
    results
      ? [...results.values()].filter((entry) => entry.status === status).length
      : 0;

  const deleted = resultCount("deleted");
  const failed = resultCount("failed");
  const filenameMismatches = results
    ? resultCount("filename-mismatch")
    : classificationCount("filename-mismatch");
  const missing = results
    ? resultCount("missing")
    : classificationCount("missing");
  const protectedCount = results
    ? resultCount("protected")
    : classificationCount("protected");
  const tagged = results
    ? resultCount("tagged")
    : classificationCount("tagged");
  const typeMismatches = results
    ? resultCount("type-mismatch")
    : classificationCount("type-mismatch");
  const completed =
    deleted +
    missing +
    protectedCount +
    tagged +
    filenameMismatches +
    typeMismatches;

  return {
    candidates: classified.length,
    eligible: classificationCount("eligible"),
    deleted,
    failed,
    filenameMismatches,
    missing,
    paused,
    processed: results?.size ?? 0,
    protected: protectedCount,
    remaining: results ? Math.max(0, classified.length - completed) : 0,
    reportSha256,
    ...(resultPath ? { resultPath } : {}),
    tagged,
    typeMismatches,
  };
};

const logCleanupSummary = (
  logger: SyncLogger,
  summary: CleanupLegacySummary,
  apply: boolean,
) => {
  if (!apply) {
    logger.info(
      [
        "Legacy cleanup dry run",
        formatRows([
          ["Candidates", summary.candidates],
          ["Eligible", summary.eligible],
          ["Missing", summary.missing],
          ["Protected", summary.protected],
          ["Tagged", summary.tagged],
          ["Mismatched", summary.filenameMismatches + summary.typeMismatches],
        ]),
        "",
        "Report SHA-256",
        `  ${summary.reportSha256}`,
        "",
        "Apply",
        `  pnpm sync-media:cleanup-legacy -- --apply --report-sha256=${summary.reportSha256}`,
      ].join("\n"),
    );
    return;
  }

  logger.info(
    [
      "Legacy cleanup complete",
      formatRows([
        ["Candidates", summary.candidates],
        ["Processed", summary.processed],
        ["Deleted", summary.deleted],
        ["Missing", summary.missing],
        ["Skipped", skippedCount(summary)],
        ["Failed", summary.failed],
      ]),
      ...(summary.resultPath
        ? ["", "Checkpoint", `  ${displayPath(summary.resultPath)}`]
        : []),
    ].join("\n"),
  );
};

const logPausedCleanupSummary = (
  logger: SyncLogger,
  summary: CleanupLegacySummary,
) => {
  logger.info(
    [
      "Legacy cleanup paused safely",
      formatRows([
        ["Candidates", summary.candidates],
        ["Processed", summary.processed],
        ["Deleted", summary.deleted],
        ["Missing", summary.missing],
        ["Skipped", skippedCount(summary)],
        ["Failed", summary.failed],
        ["Remaining", summary.remaining],
      ]),
      ...(summary.resultPath
        ? ["", "Checkpoint", `  ${displayPath(summary.resultPath)}`]
        : []),
      "",
      "Resume",
      "  Rerun the same apply command and report SHA-256.",
      "  Do not regenerate the audit.",
    ].join("\n"),
  );
};

const formatDuration = (seconds: number): string => {
  const rounded = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const logCleanupProgress = (options: {
  candidates: number;
  logger: SyncLogger;
  processedThisRun: number;
  queuedThisRun: number;
  results: Map<string, LegacyCleanupResultItem>;
  startedAt: number;
}) => {
  const statuses = [...options.results.values()].reduce<
    Partial<Record<LegacyCleanupResultItem["status"], number>>
  >((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const skipped =
    (statuses.protected ?? 0) +
    (statuses.tagged ?? 0) +
    (statuses["filename-mismatch"] ?? 0) +
    (statuses["type-mismatch"] ?? 0);
  const elapsedSeconds = Math.max((Date.now() - options.startedAt) / 1000, 0.1);
  const rate = options.processedThisRun / elapsedSeconds;
  const remainingThisRun = Math.max(
    0,
    options.queuedThisRun - options.processedThisRun,
  );
  const performance =
    rate > 0
      ? ` | ${rate.toFixed(1)}/s | ETA ${formatDuration(remainingThisRun / rate)}`
      : "";

  options.logger.info(
    `Progress ${formatCount(options.results.size)}/${formatCount(options.candidates)} | deleted ${formatCount(statuses.deleted ?? 0)} | missing ${formatCount(statuses.missing ?? 0)} | skipped ${formatCount(skipped)} | failed ${formatCount(statuses.failed ?? 0)} | queued ${formatCount(remainingThisRun)}${performance}`,
  );
};

const validatePositiveInteger = (value: number, name: string) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const deleteLegacyCandidate = async (
  candidate: LegacyAuditCandidate,
  client: MediaClient,
  protectedIds: Set<string>,
): Promise<LegacyCleanupResultItem> => {
  try {
    if (protectedIds.has(candidate.id)) {
      return resultItem(candidate, "protected");
    }

    const remote = await client.getMedia(candidate.id, candidate.type);
    if (!remote) return resultItem(candidate, "missing");
    if (remote.type !== candidate.type) {
      return resultItem(candidate, "type-mismatch");
    }
    if (remote.creator !== undefined) {
      return resultItem(candidate, "tagged");
    }
    if (remote.filename !== candidate.filename) {
      return resultItem(candidate, "filename-mismatch");
    }

    await client.deleteMedia(candidate);
    return resultItem(candidate, "deleted");
  } catch (error) {
    return resultItem(
      candidate,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
  }
};

/**
 * Deletes explicitly audited legacy media with checksum approval and resumable
 * checkpoints. Dry-run is the default and never writes a checkpoint.
 */
export const cleanupLegacyMedia = async (
  options: CleanupLegacyOptions,
): Promise<CleanupLegacySummary> => {
  const logger = options.logger ?? defaultLogger;
  const apply = options.apply ?? false;
  const checkpointBatchSize = options.checkpointBatchSize ?? 20;
  const deleteConcurrency = options.deleteConcurrency ?? 3;
  validatePositiveInteger(checkpointBatchSize, "checkpointBatchSize");
  validatePositiveInteger(deleteConcurrency, "deleteConcurrency");

  const reportPath = options.reportPath ?? DEFAULT_AUDIT_PATH;
  const { report, reportSha256 } = await readLegacyAuditReport(reportPath);
  if (apply) {
    const expected = options.expectedReportSha256?.toLowerCase();
    if (!expected) {
      throw new Error(
        "Legacy cleanup apply requires --report-sha256 from a successful dry run.",
      );
    }
    if (!/^[a-f0-9]{64}$/.test(expected) || expected !== reportSha256) {
      throw new Error(
        `Legacy cleanup report checksum mismatch. Current report sha256: ${reportSha256}`,
      );
    }
  }

  let manifest: Manifest;
  try {
    manifest = await readManifest(
      options.manifestPath ?? DEFAULT_MANIFEST_PATH,
    );
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      throw new Error(
        'Legacy cleanup requires the generated manifest. Run "pnpm sync-media" first.',
      );
    }
    throw error;
  }
  const protectedIds = new Set(
    Object.values(manifest).map((entry) => entry.id),
  );
  const [images, videos] = await Promise.all([
    options.client.listImages(),
    options.client.listVideos(),
  ]);
  const classified = classifyLegacyCandidates(
    report.candidates,
    [...images, ...videos],
    protectedIds,
  );

  if (!apply) {
    const summary = summarizeCleanup(classified, reportSha256);
    logCleanupSummary(logger, summary, false);
    return summary;
  }

  const resultPath =
    options.resultPath ??
    `${DEFAULT_CLEANUP_RESULT_PREFIX}-${reportSha256.slice(0, 12)}.json`;
  const previous = await readCleanupResult(resultPath, reportSha256);
  const results = new Map<string, LegacyCleanupResultItem>();
  for (const item of previous?.results ?? []) {
    const key = cleanupKey(item);
    if (results.has(key)) {
      throw new Error(
        `Cleanup checkpoint contains duplicate result ${item.type}:${item.id}`,
      );
    }
    results.set(key, item);
  }

  const toDelete: LegacyAuditCandidate[] = [];
  for (const entry of classified) {
    const key = cleanupKey(entry.candidate);
    const completed = results.get(key);
    if (completed?.status === "deleted" || completed?.status === "missing") {
      continue;
    }
    if (entry.classification === "eligible") {
      results.delete(key);
      toDelete.push(entry.candidate);
    } else {
      results.set(key, resultItem(entry.candidate, entry.classification));
    }
  }
  await writeCleanupResult(
    resultPath,
    report.generatedAt,
    reportSha256,
    results,
  );
  const startedAt = Date.now();
  const restoredSummary = summarizeCleanup(
    classified,
    reportSha256,
    results,
    resultPath,
  );
  logger.info(
    [
      "Legacy cleanup",
      formatRows([
        ["Candidates", classified.length],
        [
          "Already completed",
          restoredSummary.deleted + restoredSummary.missing,
        ],
        ["Skipped", skippedCount(restoredSummary)],
        ["Queued", toDelete.length],
        ["Batch size", checkpointBatchSize],
        ["Checkpoint", displayPath(resultPath)],
      ]),
      "",
      "Safe cancellation",
      "  Ctrl+C once: pause, finish in-flight requests, save checkpoint.",
      "  Ctrl+C again after 2 seconds: force an immediate exit.",
      "  Resume with the same command and SHA-256; do not rerun audit.",
    ].join("\n"),
  );

  for (
    let offset = 0;
    offset < toDelete.length;
    offset += checkpointBatchSize
  ) {
    if (options.signal?.aborted) break;
    const batch = toDelete.slice(offset, offset + checkpointBatchSize);
    const batchResults = await mapConcurrent(
      batch,
      deleteConcurrency,
      (candidate) =>
        options.signal?.aborted
          ? Promise.resolve(undefined)
          : deleteLegacyCandidate(candidate, options.client, protectedIds),
    );
    const completedResults = batchResults.filter(
      (item): item is LegacyCleanupResultItem => item !== undefined,
    );
    for (const item of completedResults) results.set(cleanupKey(item), item);
    await writeCleanupResult(
      resultPath,
      report.generatedAt,
      reportSha256,
      results,
    );
    logCleanupProgress({
      candidates: classified.length,
      logger,
      processedThisRun: Math.min(
        offset + completedResults.length,
        toDelete.length,
      ),
      queuedThisRun: toDelete.length,
      results,
      startedAt,
    });
    if (options.signal?.aborted) break;
  }

  const summary = summarizeCleanup(
    classified,
    reportSha256,
    results,
    resultPath,
    options.signal?.aborted ?? false,
  );
  if (summary.paused) {
    logPausedCleanupSummary(logger, summary);
    return summary;
  }
  logCleanupSummary(logger, summary, true);
  if (summary.failed > 0) {
    throw new Error(
      `${summary.failed} legacy cleanup deletions failed; rerun the same command to resume.`,
    );
  }
  return summary;
};
