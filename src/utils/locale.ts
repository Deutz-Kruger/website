export const SUPPORTED_LOCALES = ["en", "de"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleAlternates {
  de: string;
  en: string;
  xDefault: string;
}

/** Returns a supported locale when the first URL path segment is localized. */
export const getLocaleFromPath = (
  pathname: string,
): SupportedLocale | undefined => {
  const locale = pathname.split("/")[1];
  return SUPPORTED_LOCALES.find((candidate) => candidate === locale);
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
