export interface SeoImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  type?: string;
}

export type StructuredData = Record<string, unknown>;

interface CaseTitleBlock {
  _block: string;
  title?: string;
  subHeading?: string;
}

export interface CaseSeoSource {
  lang: "de" | "en";
  tags?: string[];
  groups: Array<{
    blocks: CaseTitleBlock[];
  }>;
}

export interface CaseSeoData {
  title: string;
  description: string;
  canonical: string;
  socialImage: SeoImage;
  structuredData: StructuredData;
}

/** Builds an absolute canonical URL without query parameters or fragments. */
export const buildCanonicalUrl = (
  siteUrl: string,
  pathname: string,
): string => {
  const canonical = new URL(pathname, `${siteUrl.replace(/\/$/, "")}/`);
  canonical.search = "";
  canonical.hash = "";
  return canonical.toString();
};

/** Normalizes CMS text for metadata and truncates it at a word boundary. */
export const normalizeMetaDescription = (
  value: string,
  maxLength = 160,
): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength).trimEnd();
  const wordBoundary = candidate.lastIndexOf(" ");
  const truncated =
    wordBoundary > maxLength / 2 ? candidate.slice(0, wordBoundary) : candidate;

  return `${truncated.replace(/[,:;.!?\-–—]+$/, "")}…`;
};

/** Resolves robots directives for production pages and blocked previews. */
export const getRobotsContent = (appEnv: string, noIndex = false): string => {
  if (appEnv !== "production") return "noindex, nofollow";
  return noIndex ? "noindex, follow" : "index, follow";
};

/** Derives case-study metadata and JSON-LD from existing CMS fields. */
export const getCaseSeoData = (
  caseEntry: CaseSeoSource,
  siteUrl: string,
  pathname: string,
  socialImage: SeoImage,
): CaseSeoData => {
  const titleBlock = caseEntry.groups
    .flatMap((group) => group.blocks)
    .find(
      (block) =>
        block._block === "title" &&
        typeof block.title === "string" &&
        typeof block.subHeading === "string",
    );

  if (!titleBlock?.title || !titleBlock.subHeading) {
    throw new Error(`Case at "${pathname}" requires a title block for SEO`);
  }

  const canonical = buildCanonicalUrl(siteUrl, pathname);
  const title = titleBlock.title.trim();
  const description = normalizeMetaDescription(titleBlock.subHeading);
  const pageId = `${canonical}#webpage`;
  const workId = `${canonical}#creative-work`;
  const imageId = `${canonical}#primaryimage`;
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");

  const structuredData: StructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageId,
        url: canonical,
        name: title,
        description,
        inLanguage: caseEntry.lang,
        isPartOf: {
          "@id": `${normalizedSiteUrl}/#website`,
        },
        primaryImageOfPage: {
          "@id": imageId,
        },
        mainEntity: {
          "@id": workId,
        },
      },
      {
        "@type": "CreativeWork",
        "@id": workId,
        url: canonical,
        name: title,
        description,
        inLanguage: caseEntry.lang,
        image: {
          "@id": imageId,
        },
        keywords: caseEntry.tags,
        creator: {
          "@id": `${normalizedSiteUrl}/#organization`,
        },
      },
      {
        "@type": "ImageObject",
        "@id": imageId,
        url: socialImage.url,
        contentUrl: socialImage.url,
        width: socialImage.width,
        height: socialImage.height,
        caption: socialImage.alt,
      },
    ],
  };

  return {
    title,
    description,
    canonical,
    socialImage,
    structuredData,
  };
};
