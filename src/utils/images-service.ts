import type { ExternalImageService } from "astro";

type VariantName = "thumbnail" | "small" | "medium" | "large";

interface Variant {
  name: VariantName;
  width: number;
}

const CLOUDFLARE_ACCOUNT = "MdnPOFk9l0bFpoVPozEWbw";
const BASE_URL = "https://imagedelivery.net";

const VARIANTS: Variant[] = [
  { name: "thumbnail", width: 480 },
  { name: "small", width: 768 },
  { name: "medium", width: 1280 },
  { name: "large", width: 1920 },
] as const;

const service: ExternalImageService = {
  getURL(options) {
    const variantToUse = options.variantName || "large";
    return `${BASE_URL}/${CLOUDFLARE_ACCOUNT}/${options.src}/${variantToUse}`;
  },
  getSrcSet(options) {
    const srcSet = VARIANTS.map((variant) => ({
      transform: {
        src: options.src,
        variantName: variant.name,
      },
      descriptor: `${variant.width}w`,
    }));

    return srcSet;
  },
  getHTMLAttributes(options) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      src,
      sizes,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      format,
      width,
      height,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      quality,
      ...attributes
    } = options;
    return {
      ...attributes,
      width,
      height,
      loading: options.loading ?? "lazy",
      decoding: options.decoding ?? "sync",
      sizes,
    };
  },
};

export default service;
