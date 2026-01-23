import type Swup from "swup";

import { setLang } from "@/stores/langStore";

let swupInstance: Swup | null = null;

export const setSwupInstance = (instance: Swup) => {
  swupInstance = instance;
};

let enClickHandler: (() => void) | null = null;
let deClickHandler: (() => void) | null = null;

const handleLanguageSwitch = (newLang: "de" | "en") => {
  console.log(
    "[handleLanguageSwitch] Switching to:",
    newLang,
    "Current URL:",
    window.location.pathname,
  );
  setLang(newLang);
  document.cookie = `lang=${newLang}; path=/; SameSite=None; Secure`;
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");

  if (pathSegments[1] === newLang) return;

  pathSegments[1] = newLang;
  const newPath = pathSegments.join("/");

  console.log("[handleLanguageSwitch] Navigating to:", newPath);

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
    if (href?.startsWith("/en/") || href?.startsWith("/de/")) {
      const pathWithoutLang = href.substring(3);
      link.setAttribute("href", `/${lang}${pathWithoutLang}`);
    }
  });

  const logoLink = document.querySelector("#fixed-logo-container a");
  if (logoLink instanceof HTMLAnchorElement) {
    logoLink.setAttribute("href", `/${lang}/`);
  }
};

const syncLanguageWithUrl = () => {
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");
  const currentLang = pathSegments[1];

  console.log("[syncLanguageWithUrl] URL:", currentPath, "Lang:", currentLang);

  if (currentLang === "en" || currentLang === "de") {
    setLang(currentLang);
    document.cookie = `lang=${currentLang}; path=/; SameSite=None; Secure`;
    return currentLang;
  }
  console.log("Current Lang", currentLang);
  return "en";
};

export const initLangSelect = () => {
  console.log("[initLangSelect] Initializing...");
  const currentLang = syncLanguageWithUrl();
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  console.log("[initLangSelect] Elements found:", !!enElement, !!deElement);
  console.log("[initLangSelect] EN classes:", enElement?.className);
  console.log("[initLangSelect] DE classes:", deElement?.className);

  const lang = currentLang;

  switch (lang) {
    case "en":
      enElement?.classList.remove("inactive-lang");
      deElement?.classList.add("inactive-lang");
      break;
    case "de":
      deElement?.classList.remove("inactive-lang");
      enElement?.classList.add("inactive-lang");
      break;
  }

  updateNavLinks(lang);

  if (!enElement || !deElement) {
    return;
  }

  if (
    enElement.dataset.listenerAttached === "true" ||
    deElement.dataset.listenerAttached === "true"
  ) {
    console.log("[initLangSelect] Listeners already attached, skipping");
    return;
  }

  enClickHandler = () => {
    enElement.classList.remove("inactive-lang");
    deElement.classList.add("inactive-lang");
    handleLanguageSwitch("en");
  };

  deClickHandler = () => {
    deElement.classList.remove("inactive-lang");
    enElement.classList.add("inactive-lang");
    handleLanguageSwitch("de");
  };

  enElement.addEventListener("click", enClickHandler);
  enElement.dataset.listenerAttached = "true";

  deElement.addEventListener("click", deClickHandler);
  deElement.dataset.listenerAttached = "true";
};

export const cleanUpLangSelect = () => {
  console.log("[cleanUpLangSelect] Cleaning up...");
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
