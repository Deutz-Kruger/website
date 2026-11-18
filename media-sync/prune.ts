import type { MediaClient } from "./cloudflare";
import { DEFAULT_MANIFEST_PATH, readManifest } from "./manifest";
import { defaultLogger, type SyncLogger } from "./reporting";
import { MEDIA_CREATOR } from "./schema";
import { clearStaleMarker, getMetadata } from "./sync";

export const STALE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Marks or deletes stale managed media after a successful deployment. */
export const pruneMedia = async (
  options: PruneOptions,
): Promise<PruneSummary> => {
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? new Date();
  const manifest = await readManifest(
    options.manifestPath ?? DEFAULT_MANIFEST_PATH,
  );
  const keepIds = new Set(
    Object.values(manifest.entries).map((entry) => entry.id),
  );
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
      await clearStaleMarker(
        options.client,
        media,
        metadata,
        options.dryRun ?? false,
      );
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
