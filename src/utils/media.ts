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

/**
 * Generates a Cloudflare Stream poster image URL for a video source path.
 * Uses first frame (time=0s) at 720p resolution (1280x720).
 *
 * @param src - The source path of the video file (e.g., "/src/content/media/video.mp4").
 * @returns The full URL to the Cloudflare Stream thumbnail/poster image.
 */
export const getVideoPoster = (src: string): string => {
  const mediaEntry = getMedia(src);
  const videoId = mediaEntry.id;
  const encodedId = encodeURIComponent(videoId);
  return `${CLOUDFLARE_STREAM_URL}/${encodedId}/thumbnails/thumbnail.jpg?time=0s&width=1280&height=720`;
};
