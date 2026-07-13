import { createHash } from "node:crypto";
import { openAsBlob } from "node:fs";
import { basename } from "node:path";

import { z } from "zod";

import {
  type LocalMediaFile,
  type ManagedMetadata,
  MEDIA_CREATOR,
  type MediaType,
  type RemoteMedia,
} from "./schema";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const MAX_RETRIES = 3;
const VIDEO_PAGE_SIZE = 1000;

type Fetch = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

type Sleep = (milliseconds: number) => Promise<void>;

interface ApiErrorItem {
  code?: number;
  message?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: ApiErrorItem[];
  messages?: ApiErrorItem[];
  total?: number;
}

export interface CloudflareClientOptions {
  accountId: string;
  apiToken: string;
  fetch?: Fetch;
  sleep?: Sleep;
}

export interface VideoWaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const imageSchema = z.object({
  id: z.string(),
  creator: z.string().nullish(),
  filename: z.string().nullish(),
  uploaded: z.string().nullish(),
  meta: z.unknown().optional(),
});

const videoSchema = z.object({
  uid: z.string(),
  creator: z.string().nullish(),
  created: z.string().nullish(),
  uploaded: z.string().nullish(),
  readyToStream: z.boolean().nullish(),
  meta: z.unknown().optional(),
  status: z.object({ state: z.string().nullish() }).nullish(),
});

const imagesPageSchema = z.object({
  images: z.array(imageSchema).default([]),
  continuation_token: z.string().nullish(),
});

const directUploadSchema = z.object({
  uid: z.string(),
  uploadURL: z.url(),
});

const videoListSchema = z.union([
  z.array(videoSchema),
  z.object({
    range: z.number().optional(),
    total: z.number().optional(),
    videos: z.array(videoSchema),
  }),
]);

const formatErrors = (errors: ApiErrorItem[] | undefined): string => {
  if (!errors?.length) return "No API error details returned";
  return errors
    .map((error) =>
      [error.code, error.message]
        .filter((value) => value !== undefined)
        .join(": "),
    )
    .join("; ");
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    throw new Error(
      `Cloudflare returned non-JSON response (${response.status} ${response.statusText})`,
    );
  }
};

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const retryDelay = (response: Response, attempt: number): number => {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  }
  return 250 * 2 ** attempt;
};

const toRemoteImage = (image: z.infer<typeof imageSchema>): RemoteMedia => ({
  id: image.id,
  type: "image",
  creator: image.creator ?? undefined,
  filename: image.filename ?? undefined,
  uploaded: image.uploaded ?? undefined,
  metadata: image.meta,
  readyToStream: true,
  status: "ready",
});

const getVideoName = (metadata: unknown): string | undefined => {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "name" in metadata &&
    typeof metadata.name === "string"
  ) {
    return metadata.name;
  }
  return undefined;
};

const toRemoteVideo = (video: z.infer<typeof videoSchema>): RemoteMedia => ({
  id: video.uid,
  type: "video",
  creator: video.creator ?? undefined,
  filename: getVideoName(video.meta),
  uploaded: video.uploaded ?? video.created ?? undefined,
  metadata: video.meta,
  readyToStream: video.readyToStream ?? undefined,
  status: video.status?.state ?? undefined,
});

const imageCustomId = (file: LocalMediaFile): string => {
  const pathDigest = createHash("sha256")
    .update(file.sourcePath)
    .digest("hex")
    .slice(0, 16);
  return `dk-media/${pathDigest}/${file.sha256}`;
};

const encodeMediaId = (id: string) =>
  id.split("/").map(encodeURIComponent).join("/");

export const getCloudflareConfig = (): CloudflareClientOptions => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_MEDIA_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_MEDIA_API_TOKEN are required.",
    );
  }
  return { accountId, apiToken };
};

export class CloudflareMediaClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly fetch: Fetch;
  private readonly sleep: Sleep;

  constructor(options: CloudflareClientOptions) {
    this.accountId = options.accountId;
    this.apiToken = options.apiToken;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private accountUrl(path: string): string {
    return `${API_ROOT}/accounts/${this.accountId}${path}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    options?: { idempotent?: boolean; allowNotFound?: boolean },
  ): Promise<ApiEnvelope<T> | null> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiToken}`);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetch(this.accountUrl(path), {
          ...init,
          headers,
        });
      } catch (error) {
        if (options?.idempotent && attempt < MAX_RETRIES) {
          await this.sleep(250 * 2 ** attempt);
          continue;
        }
        throw new Error(
          `Cloudflare request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (response.status === 404 && options?.allowNotFound) return null;

      if (
        options?.idempotent &&
        isRetryableStatus(response.status) &&
        attempt < MAX_RETRIES
      ) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }

      const rawBody = await parseJson(response);
      const body =
        typeof rawBody === "object" && rawBody !== null
          ? (rawBody as Partial<ApiEnvelope<T>>)
          : undefined;
      if (!response.ok || body?.success !== true || body.result === undefined) {
        throw new Error(
          `Cloudflare API error (${response.status} ${response.statusText}): ${formatErrors(body?.errors)}`,
        );
      }
      return body as ApiEnvelope<T>;
    }

    throw new Error("Cloudflare request exhausted all retries");
  }

  async listImages(creator?: string): Promise<RemoteMedia[]> {
    const images: RemoteMedia[] = [];
    let continuationToken: string | undefined;

    do {
      const query = new URLSearchParams({ per_page: "1000" });
      if (creator !== undefined) query.set("creator", creator);
      if (continuationToken) {
        query.set("continuation_token", continuationToken);
      }
      const envelope = await this.request<unknown>(
        `/images/v2?${query.toString()}`,
        {},
        { idempotent: true },
      );
      const page = imagesPageSchema.parse(envelope?.result);
      images.push(...page.images.map(toRemoteImage));
      continuationToken = page.continuation_token ?? undefined;
    } while (continuationToken);

    return images;
  }

  async listVideos(creator?: string): Promise<RemoteMedia[]> {
    const videos = new Map<string, RemoteMedia>();
    let after: string | undefined;

    while (true) {
      const query = new URLSearchParams({
        asc: "true",
        include_counts: "true",
        limit: VIDEO_PAGE_SIZE.toString(),
      });
      if (creator !== undefined) query.set("creator", creator);
      if (after) query.set("after", after);

      const envelope = await this.request<unknown>(
        `/stream?${query.toString()}`,
        {},
        { idempotent: true },
      );
      const parsedPage = videoListSchema.parse(envelope?.result);
      const page = Array.isArray(parsedPage) ? parsedPage : parsedPage.videos;
      const previousSize = videos.size;
      page.map(toRemoteVideo).forEach((video) => videos.set(video.id, video));

      if (page.length < VIDEO_PAGE_SIZE) break;
      const cursor = page.at(-1)?.created ?? page.at(-1)?.uploaded;
      if (!cursor || videos.size === previousSize || cursor === after) {
        throw new Error(
          "Cloudflare Stream inventory pagination did not advance; refusing incomplete inventory.",
        );
      }
      after = cursor;
    }

    return [...videos.values()];
  }

  async listManagedMedia(): Promise<RemoteMedia[]> {
    const [images, videos] = await Promise.all([
      this.listImages(MEDIA_CREATOR),
      this.listVideos(MEDIA_CREATOR),
    ]);
    return [...images, ...videos];
  }

  async getMedia(id: string, type: MediaType): Promise<RemoteMedia | null> {
    if (type === "image") {
      const envelope = await this.request<unknown>(
        `/images/v1/${encodeMediaId(id)}`,
        {},
        { allowNotFound: true, idempotent: true },
      );
      return envelope
        ? toRemoteImage(imageSchema.parse(envelope.result))
        : null;
    }

    const envelope = await this.request<unknown>(
      `/stream/${encodeMediaId(id)}`,
      {},
      { allowNotFound: true, idempotent: true },
    );
    return envelope ? toRemoteVideo(videoSchema.parse(envelope.result)) : null;
  }

  async uploadImage(
    file: LocalMediaFile,
    metadata: ManagedMetadata,
  ): Promise<RemoteMedia> {
    const formData = new FormData();
    formData.append(
      "file",
      await openAsBlob(file.absolutePath),
      basename(file.absolutePath),
    );
    formData.append("id", imageCustomId(file));
    formData.append("creator", MEDIA_CREATOR);
    formData.append("metadata", JSON.stringify(metadata));

    const envelope = await this.request<unknown>("/images/v1", {
      method: "POST",
      body: formData,
    });
    return toRemoteImage(imageSchema.parse(envelope?.result));
  }

  async uploadVideo(
    file: LocalMediaFile,
    metadata: ManagedMetadata,
  ): Promise<RemoteMedia> {
    const maxDurationSeconds = file.duration
      ? Math.min(36000, Math.max(1, Math.ceil(file.duration) + 5))
      : 36000;
    const envelope = await this.request<unknown>("/stream/direct_upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator: MEDIA_CREATOR,
        maxDurationSeconds,
        meta: { ...metadata, name: basename(file.absolutePath) },
      }),
    });
    const directUpload = directUploadSchema.parse(envelope?.result);

    const formData = new FormData();
    formData.append(
      "file",
      await openAsBlob(file.absolutePath),
      basename(file.absolutePath),
    );
    const uploadResponse = await this.fetch(directUpload.uploadURL, {
      method: "POST",
      body: formData,
    });
    if (!uploadResponse.ok) {
      throw new Error(
        `Cloudflare Stream upload failed (${uploadResponse.status} ${uploadResponse.statusText})`,
      );
    }

    return {
      id: directUpload.uid,
      type: "video",
      creator: MEDIA_CREATOR,
      filename: basename(file.absolutePath),
      metadata: { ...metadata, name: basename(file.absolutePath) },
      readyToStream: false,
      status: "queued",
    };
  }

  async waitForVideoReady(
    id: string,
    options?: VideoWaitOptions,
  ): Promise<RemoteMedia> {
    const intervalMs = options?.intervalMs ?? 5000;
    const timeoutMs = options?.timeoutMs ?? 10 * 60 * 1000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const video = await this.getMedia(id, "video");
      if (!video) throw new Error(`Uploaded Stream video disappeared: ${id}`);
      if (video.readyToStream || video.status === "ready") return video;
      if (video.status === "error") {
        throw new Error(`Cloudflare Stream encoding failed: ${id}`);
      }
      await this.sleep(intervalMs);
    }

    throw new Error(`Timed out waiting for Cloudflare Stream video: ${id}`);
  }

  async updateMetadata(
    media: Pick<RemoteMedia, "filename" | "id" | "type">,
    metadata: ManagedMetadata,
  ): Promise<void> {
    const path =
      media.type === "image"
        ? `/images/v1/${encodeMediaId(media.id)}`
        : `/stream/${encodeMediaId(media.id)}`;
    const method = media.type === "image" ? "PATCH" : "POST";
    const body =
      media.type === "image"
        ? { creator: MEDIA_CREATOR, metadata }
        : {
            creator: MEDIA_CREATOR,
            meta: {
              ...metadata,
              ...(media.filename ? { name: media.filename } : {}),
            },
          };
    await this.request(
      path,
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { idempotent: true },
    );
  }

  async deleteMedia(media: Pick<RemoteMedia, "id" | "type">): Promise<void> {
    const path =
      media.type === "image"
        ? `/images/v1/${encodeMediaId(media.id)}`
        : `/stream/${encodeMediaId(media.id)}`;
    await this.request(
      path,
      { method: "DELETE" },
      { idempotent: true, allowNotFound: true },
    );
  }
}
