import type Swup from "swup";

import { langSelection, setLang } from "@/stores/langStore";

let swupInstance: Swup | null = null;

export const setSwupInstance = (instance: Swup) => {
  swupInstance = instance;
};

let enClickHandler: (() => void) | null = null;
let deClickHandler: (() => void) | null = null;

const handleLanguageSwitch = (newLang: "de" | "en") => {
  setLang(newLang);
  document.cookie = `lang=${newLang}; SameSite=None; Secure`;
  const currentPath = window.location.pathname;
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

const syncLanguageWithUrl = () => {
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");
  const currentLang = pathSegments[1];

  if (currentLang === "en" || currentLang === "de") {
    const storedLang = langSelection.get();
    if (storedLang !== currentLang) {
      setLang(currentLang);
      document.cookie = `lang=${currentLang}; SameSite=None; Secure`;
    }
    return currentLang;
  }
  return "en";
};

export const initLangSelect = () => {
  const currentLang = syncLanguageWithUrl();
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

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
