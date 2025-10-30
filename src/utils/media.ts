import manifest from "../../media-sync/manifest.json";
import type { ManifestEntry } from "../../media-sync/sync.ts";

const CLOUDFLARE_STREAM_URL =
  "https://customer-k0tb9kusbwt5rfcb.cloudflarestream.com";

/**
 * Retrieves media data from the manifest based on the provided source path.
 * The source path is sanitized to remove leading/trailing slashes before lookup.
 *
 * @param src - The source path of the media file (e.g., "/src/content/media/image.png").
 * @returns The ManifestEntry object for the given media, or undefined if not found.
 */
export const getMedia = (src: string): ManifestEntry => {
  const sanitizedPath = src.replace(/^\/|\/$/g, "");
  const mediaData = (manifest as Record<string, ManifestEntry>)[sanitizedPath];
  return mediaData;
};

/**
 * Generates a Cloudflare Stream video player URL for a given video ID.
 * The URL includes parameters for autoplay, muting, no controls, and looping.
 *
 * @param id - The unique ID (UID) of the video on Cloudflare Stream.
 * @returns The full URL to the Cloudflare Stream iframe player.
 */
export const getVideoPlayerUrl = (id: string) => {
  const encodedId = encodeURIComponent(id);
  return `${CLOUDFLARE_STREAM_URL}/${encodedId}/iframe?autoplay=true&muted=true&controls=false&loop=true`;
};
