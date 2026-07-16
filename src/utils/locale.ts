export const SUPPORTED_LOCALES = ["en", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleAlternates {
  de: string;
  en: string;
  xDefault: string;
}

const GERMAN_ONLY_LEGAL_PATH = /^\/(?:de|en)\/(impressum|privacy)\/?$/;

/** Returns a supported locale when the first URL path segment is localized. */
export const getLocaleFromPath = (
  pathname: string,
): SupportedLocale | undefined => {
  const locale = pathname.split("/")[1];
  return SUPPORTED_LOCALES.find((candidate) => candidate === locale);
};

/** Maps either localized legal URL to its sole German canonical route. */
export const getGermanLegalPath = (pathname: string): string | undefined => {
  const legalSlug = pathname.match(GERMAN_ONLY_LEGAL_PATH)?.[1];
  return legalSlug ? `/de/${legalSlug}/` : undefined;
};

/** Reports whether the pathname is a canonical German-only legal route. */
export const isGermanLegalPath = (pathname: string): boolean => {
  const canonicalPath = getGermanLegalPath(pathname);
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return canonicalPath === normalizedPath;
};

/**
 * Keeps explicit language preference on German-only legal pages while using
 * the URL locale everywhere else.
 */
export const resolveNavigationLocale = (
  pathname: string,
  preferredLocale?: SupportedLocale,
): SupportedLocale => {
  const pathLocale = getLocaleFromPath(pathname) ?? "en";
  return isGermanLegalPath(pathname) && preferredLocale
    ? preferredLocale
    : pathLocale;
};

/** Builds reciprocal localized URLs for a localized pathname. */
export const getLocaleAlternates = (
  siteUrl: string,
  pathname: string,
): LocaleAlternates | undefined => {
  if (!getLocaleFromPath(pathname)) return undefined;

  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const localizedPath = pathname.replace(/^\/(?:en|de)(?=\/|$)/, "") || "/";
  const suffix = localizedPath === "/" ? "/" : localizedPath;
  const en = `${normalizedSiteUrl}/en${suffix}`;

  return {
    de: `${normalizedSiteUrl}/de${suffix}`,
    en,
    xDefault: en,
  };
};
