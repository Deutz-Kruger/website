import type { MediaClient } from "./cloudflare";
import {
  DEFAULT_MEDIA_ROOT,
  DEFAULT_PROJECT_ROOT,
  mapConcurrent,
  SYNC_CONCURRENCY,
} from "./config";
import { scanLocalMedia } from "./file-utils";
import { DEFAULT_MANIFEST_PATH, writeManifest } from "./manifest";
import { defaultLogger, type SyncLogger } from "./reporting";
import {
  type LocalMediaFile,
  localMediaFileSchema,
  type ManagedMetadata,
  managedMetadataSchema,
  type ManifestEntry,
  MEDIA_SCHEMA_VERSION,
  type RemoteMedia,
} from "./schema";

const ACTIVE_VIDEO_STATES = new Set(["downloading", "inprogress", "queued"]);

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

export const getMetadata = (
  media: RemoteMedia,
): ManagedMetadata | undefined => {
  const parsed = managedMetadataSchema.safeParse(media.metadata);
  return parsed.success ? parsed.data : undefined;
};

export const createMetadata = (
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

/**
 * Clears a stale marker on kept media and reports whether one was present.
 * Sync reuses this for recycled assets and prune for manifest-referenced ones.
 */
export const clearStaleMarker = async (
  client: MediaClient,
  media: Pick<RemoteMedia, "filename" | "id" | "type">,
  metadata: ManagedMetadata,
  dryRun = false,
): Promise<boolean> => {
  if (!metadata.staleSince) return false;
  if (!dryRun) {
    await client.updateMetadata(media, { ...metadata, staleSince: undefined });
  }
  return true;
};

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
  lqip: file.lqip,
});

export const buildRemoteIndex = (remoteMedia: RemoteMedia[]) => {
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

export const resolveExistingMedia = async (
  candidates: RemoteMedia[],
  options: SyncOptions,
  summary: SyncSummary,
): Promise<RemoteMedia | undefined> => {
  const ready = candidates.find(isReady);
  if (ready) {
    const metadata = getMetadata(ready);
    if (
      metadata &&
      (await clearStaleMarker(
        options.client,
        ready,
        metadata,
        options.dryRun ?? false,
      ))
    ) {
      summary.staleMarkersCleared += 1;
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
  const scannedMedia =
    options.localMedia ??
    (await scanLocalMedia({
      mediaRoot: options.mediaRoot ?? DEFAULT_MEDIA_ROOT,
      projectRoot: options.projectRoot ?? DEFAULT_PROJECT_ROOT,
    }));
  const localMedia = localMediaFileSchema.array().parse(scannedMedia);
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
    SYNC_CONCURRENCY,
    async (file): Promise<[string, ManifestEntry] | undefined> => {
      const candidates = remoteIndex
        .get(metadataKey(file.sourcePath, file.sha256))
        ?.filter((candidate) => candidate.type === file.type);
      const existing = candidates?.length
        ? await resolveExistingMedia(candidates, options, summary)
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
