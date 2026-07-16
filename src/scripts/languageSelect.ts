import type Swup from "swup";

import { setLang } from "@/stores/langStore";
import {
  getGermanLegalPath,
  getLocaleFromPath,
  isGermanLegalPath,
  resolveNavigationLocale,
  type SupportedLocale,
} from "@/utils/locale";

let swupInstance: Swup | null = null;

export const setSwupInstance = (instance: Swup) => {
  swupInstance = instance;
};

let enClickHandler: (() => void) | null = null;
let deClickHandler: (() => void) | null = null;

const setSelectedLanguage = (lang: SupportedLocale) => {
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  enElement?.classList.toggle("inactive-lang", lang !== "en");
  deElement?.classList.toggle("inactive-lang", lang !== "de");
};

const getLanguageCookie = (): SupportedLocale | undefined => {
  const cookieLocale = document.cookie.match(
    /(?:^|;\s*)lang=([A-Za-z-]+)/,
  )?.[1];
  return cookieLocale === "en" || cookieLocale === "de"
    ? cookieLocale
    : undefined;
};

const handleLanguageSwitch = (newLang: "de" | "en") => {
  setLang(newLang);
  document.cookie = `lang=${newLang}; path=/; SameSite=None; Secure`;
  const currentPath = window.location.pathname;

  if (isGermanLegalPath(currentPath)) {
    setSelectedLanguage(newLang);
    updateNavLinks(newLang);
    return;
  }

  const pathSegments = currentPath.split("/");

  if (pathSegments[1] === newLang) return;

  pathSegments[1] = newLang;
  const newPath = pathSegments.join("/");

  if (swupInstance) {
    swupInstance.navigate(newPath, { animate: false });
  } else {
    window.location.href = newPath;
  }
};

const updateNavLinks = (lang: "de" | "en") => {
  const navLinks = document.querySelectorAll("nav a, footer a");
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href?.startsWith("/")) return;

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    const legalPath = getGermanLegalPath(url.pathname);
    if (legalPath) {
      link.setAttribute("href", `${legalPath}${url.search}${url.hash}`);
      return;
    }

    if (!getLocaleFromPath(url.pathname)) return;

    url.pathname = url.pathname.replace(/^\/(?:en|de)(?=\/|$)/, `/${lang}`);
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });

  const logoLink = document.querySelector("#fixed-logo-container a");
  if (logoLink instanceof HTMLAnchorElement) {
    logoLink.setAttribute("href", `/${lang}/`);
  }
};

const syncLanguageWithUrl = () => {
  const currentPath = window.location.pathname;
  const pathLocale = getLocaleFromPath(currentPath);

  if (pathLocale) {
    const currentLang = resolveNavigationLocale(
      currentPath,
      getLanguageCookie(),
    );
    setLang(currentLang);
    document.cookie = `lang=${currentLang}; path=/; SameSite=None; Secure`;
    return currentLang;
  }

  return "en";
};

export const initLangSelect = () => {
  const currentLang = syncLanguageWithUrl();
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  const lang = currentLang;

  setSelectedLanguage(lang);

  updateNavLinks(lang);

  if (!enElement || !deElement) {
    return;
  }

  if (
    enElement.dataset.listenerAttached === "true" ||
    deElement.dataset.listenerAttached === "true"
  ) {
    return;
  }

  enClickHandler = () => {
    enElement.classList.remove("inactive-lang");
    deElement.classList.add("inactive-lang");
    handleLanguageSwitch("de");
  };

  deClickHandler = () => {
    deElement.classList.remove("inactive-lang");
    enElement.classList.add("inactive-lang");
    handleLanguageSwitch("en");
  };

  enElement.addEventListener("click", enClickHandler);
  enElement.dataset.listenerAttached = "true";

  deElement.addEventListener("click", deClickHandler);
  deElement.dataset.listenerAttached = "true";
};

export const cleanUpLangSelect = () => {
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  if (!enElement || !deElement) {
    return;
  }

  if (enClickHandler) {
    enElement.removeEventListener("click", enClickHandler);
    enClickHandler = null;
  }

  if (deClickHandler) {
    deElement.removeEventListener("click", deClickHandler);
    deClickHandler = null;
  }

  deElement.dataset.listenerAttached = "false";
  enElement.dataset.listenerAttached = "false";
};
