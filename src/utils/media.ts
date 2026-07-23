import type { Manifest, ManifestEntry } from "../../media-sync/schema.ts";
import {
  buildVideoPosterSources,
  type VideoPosterSources,
} from "./videoPoster";

const CLOUDFLARE_STREAM_URL =
  "https://customer-k0tb9kusbwt5rfcb.cloudflarestream.com";
const CLOUDFLARE_IMAGE_URL = "https://imagedelivery.net";
const CLOUDFLARE_IMAGE_ACCOUNT = "MdnPOFk9l0bFpoVPozEWbw";
const MANIFEST_SCHEMA_VERSION = "2";

const manifestModules = import.meta.glob<{ default: Manifest }>(
  "../generated/media-manifest.json",
  { eager: true },
);
const manifest = Object.values(manifestModules)[0]?.default;

/** Returns generated Cloudflare media data for a local source path. */
export const getMedia = (src: string): ManifestEntry => {
  if (manifest?.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      'Media manifest is missing or outdated. Run "pnpm sync-media" first.',
    );
  }
  const sanitizedPath = src.replace(/^\/+|\/+$/g, "");
  const media = manifest.entries[sanitizedPath];
  if (!media) {
    throw new Error(
      `Media manifest entry missing for "${src}". Run "pnpm sync-media" first.`,
    );
  }
  if (!media.lqip) {
    throw new Error(
      `Media manifest LQIP missing for "${src}". Run "pnpm sync-media" first.`,
    );
  }
  return media;
};

/** Generates an absolute Cloudflare Images URL for a local image source path. */
export const getCloudflareImageUrl = (
  src: string,
  variant = "public",
): string => {
  const media = getMedia(src);
  if (media.type !== "image") {
    throw new Error(
      `Expected image media for "${src}", received "${media.type}"`,
    );
  }

  return `${CLOUDFLARE_IMAGE_URL}/${CLOUDFLARE_IMAGE_ACCOUNT}/${encodeURIComponent(media.id)}/${encodeURIComponent(variant)}`;
};

/** Generates a Cloudflare Stream player URL for a video ID. */
export const getVideoPlayerUrl = (id: string) => {
  const encodedId = encodeURIComponent(id);
  return `${CLOUDFLARE_STREAM_URL}/${encodedId}/iframe?autoplay=true&muted=true&controls=false&loop=true`;
};

/** Generates responsive Cloudflare Stream poster sources for a local video. */
export const getVideoPosterSources = (src: string): VideoPosterSources =>
  buildVideoPosterSources(getMedia(src), src);

export type { VideoPosterSources } from "./videoPoster";
