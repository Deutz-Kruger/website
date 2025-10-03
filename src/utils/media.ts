import manifest from "../../media-sync/manifest.json";
import type { ManifestEntry } from "../../media-sync/sync.ts";

const CLOUDFLARE_IMAGE_URL = "https://imagedelivery.net/MdnPOFk9l0bFpoVPozEWbw";
const CLOUDFLARE_STREAM_URL =
  "https://customer-k0tb9kusbwt5rfcb.cloudflarestream.com";
// TODO: Implement video fetching+

const IMAGE_VARIANTS = [
  { name: "thumbnail", width: 200 },
  { name: "large", width: 1920 },
  { name: "medium", width: 1280 },
  { name: "small", width: 768 },
] as const;

type ImageVariant = (typeof IMAGE_VARIANTS)[number]["name"];

export const getMedia = (src: string): ManifestEntry => {
  const sanitizedPath = src.replace(/^\/|\/$/g, "");
  const mediaData = (manifest as Record<string, ManifestEntry>)[sanitizedPath];
  return mediaData;
};

export const getImageUrl = (id: string, variant: ImageVariant = "large") => {
  const encodedId = encodeURIComponent(id);
  const encodedVariant = encodeURIComponent(variant);
  return `${CLOUDFLARE_IMAGE_URL}/${encodedId}/${encodedVariant}`;
};

export const getImageSet = (id: string) => {
  return {
    baseImage: getImageUrl(id, "large"),
    srcSet: getSrcSet(id),
  };
};

const getSrcSet = (id: string) => {
  const encodedId = encodeURIComponent(id);
  const srcSetParts = IMAGE_VARIANTS.map((variant) => {
    return `${CLOUDFLARE_IMAGE_URL}/${encodedId}/${variant.name} ${variant.width}w`;
  });
  return srcSetParts.join(",\n");
};

export const getVideoPlayerUrl = (id: string) => {
  const encodedId = encodeURIComponent(id);
  return `${CLOUDFLARE_STREAM_URL}/${encodedId}/iframe?autoplay=true&muted=true&controls=false&loop=true`;
};
