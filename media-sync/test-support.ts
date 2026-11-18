import { basename } from "node:path";

import type { MediaClient } from "./cloudflare";
import type { SyncLogger } from "./reporting";
import {
  type LocalMediaFile,
  type ManagedMetadata,
  MEDIA_CREATOR,
  MEDIA_SCHEMA_VERSION,
  type RemoteMedia,
} from "./schema";

export const hash = (character: string) => character.repeat(64);

export const TEST_LQIP = {
  src: "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAACwAgCdASogABAAPwFqrE6rJiQiMAgBYCAJaQAAeyAA/vDBoAA=",
  width: 32,
  height: 16,
  hasAlpha: false,
} as const;

export const SQUARE_TEST_LQIP = {
  src: "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoKAAoAA8BgJaQAA3AA/vS4AAA=",
  width: 10,
  height: 10,
  hasAlpha: false,
} as const;

export const silentLogger: SyncLogger = { info() {}, warn() {} };

export const imageFile = (
  overrides?: Partial<LocalMediaFile>,
): LocalMediaFile => ({
  absolutePath: "/tmp/image.png",
  sourcePath: "src/content/media/image.png",
  sha256: hash("a"),
  type: "image",
  width: 100,
  height: 50,
  lqip: TEST_LQIP,
  ...overrides,
});

export const metadataFor = (
  file: LocalMediaFile,
  staleSince?: string,
): ManagedMetadata => ({
  schemaVersion: MEDIA_SCHEMA_VERSION,
  sourcePath: file.sourcePath,
  sha256: file.sha256,
  ...(staleSince ? { staleSince } : {}),
});

export const remoteFor = (
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

/** In-memory MediaClient used by the sync and prune tests. */
export class FakeClient implements MediaClient {
  remote: RemoteMedia[] = [];
  deleted: RemoteMedia[] = [];
  updates: Array<{ media: RemoteMedia; metadata: ManagedMetadata }> = [];
  uploads: LocalMediaFile[] = [];
  failUpload = false;
  listManagedRequests = 0;

  async deleteMedia(media: Pick<RemoteMedia, "id" | "type">) {
    const index = this.remote.findIndex(
      (entry) => entry.id === media.id && entry.type === media.type,
    );
    if (index < 0) return;
    this.deleted.push(this.remote[index]);
    this.remote.splice(index, 1);
  }

  async getMedia(id: string, type: RemoteMedia["type"]) {
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
