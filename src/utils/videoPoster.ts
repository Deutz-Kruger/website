import type { ManifestEntry } from "../../media-sync/schema.ts";

const CLOUDFLARE_STREAM_URL =
  "https://customer-k0tb9kusbwt5rfcb.cloudflarestream.com";
const POSTER_WIDTHS = [480, 768, 1280] as const;

export interface VideoPosterSources {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

const getPosterUrl = (id: string, width: number, height: number): string =>
  `${CLOUDFLARE_STREAM_URL}/${encodeURIComponent(id)}/thumbnails/thumbnail.jpg?time=0s&width=${width}&height=${height}`;

/** Builds responsive first-frame poster sources from video metadata. */
export const buildVideoPosterSources = (
  media: ManifestEntry,
  sourcePath: string,
): VideoPosterSources => {
  if (media.type !== "video") {
    throw new Error(
      `Expected video media for "${sourcePath}", received "${media.type}"`,
    );
  }

  const variants = POSTER_WIDTHS.map((width) => {
    const height = Math.round((width * media.height) / media.width);
    return {
      url: getPosterUrl(media.id, width, height),
      width,
    };
  });

  return {
    src: variants.at(-1)?.url ?? "",
    srcset: variants
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(", "),
    width: media.width,
    height: media.height,
  };
};
