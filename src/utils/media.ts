import manifest from "../../media-sync/manifest.json";
import type { ManifestEntry } from "../../media-sync/sync.ts";

const CLOUDFLARE_IMAGE_URL = "https://imagedelivery.net/MdnPOFk9l0bFpoVPozEWbw";
const CLOUDFLARE_STREAM_URL =
  "https://customer-k0tb9kusbwt5rfcb.cloudflarestream.com";

const IMAGE_VARIANTS = [
  { name: "thumbnail", width: 200 },
  { name: "large", width: 1920 },
  { name: "medium", width: 1280 },
  { name: "small", width: 768 },
] as const;

type ImageVariant = (typeof IMAGE_VARIANTS)[number]["name"];

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
 * Generates a Cloudflare Image URL for a specific image ID and variant.
 *
 * @param id - The unique ID of the image on Cloudflare.
 * @param variant - The desired image variant. Defaults to "large".
 * The available variants are:
 * - `thumbnail`
 * - `small`
 * - `medium`
 * - `large`
 * @returns The full URL to the Cloudflare image.
 */
export const getImageUrl = (id: string, variant: ImageVariant = "large") => {
  const encodedId = encodeURIComponent(id);
  const encodedVariant = encodeURIComponent(variant);
  return `${CLOUDFLARE_IMAGE_URL}/${encodedId}/${encodedVariant}`;
};

/**
 * Generates an object containing the base image URL and a srcset string for responsive images.
 * The base image uses the "large" variant.
 *
 * @param id - The unique ID of the image on Cloudflare.
 * @returns An object with `baseImage` (URL for the large variant) and `srcSet` (string for responsive image sources).
 */
export const getImageSet = (id: string) => {
  return {
    baseImage: getImageUrl(id, "large"),
    srcSet: getSrcSet(id),
  };
};

/**
 * Generates a `srcset` string for an image, including all defined `IMAGE_VARIANTS`.
 * This allows browsers to choose the most appropriate image size based on screen resolution and density.
 *
 * @param id - The unique ID of the image on Cloudflare.
 * @returns A comma-separated string of image URLs and their corresponding widths, suitable for a `srcset` attribute.
 */
const getSrcSet = (id: string) => {
  const encodedId = encodeURIComponent(id);
  const srcSetParts = IMAGE_VARIANTS.map((variant) => {
    return `${CLOUDFLARE_IMAGE_URL}/${encodedId}/${variant.name} ${variant.width}w`;
  });
  return srcSetParts.join(",\n");
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
