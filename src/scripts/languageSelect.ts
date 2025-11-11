import { navigate } from "astro:transitions/client";

import { setLang } from "@/stores/langStore";

const handleLanguageSwitch = (newLang: "de" | "en") => {
  setLang(newLang);
  document.cookie = `lang=${newLang}; SameSite=None; Secure`;
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");

  if (pathSegments[1] === newLang) return;

  pathSegments[1] = newLang;
  const newPath = pathSegments.join("/");

  navigate(newPath);
};

const setupLangClickListeners = () => {
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  if (!enElement || !deElement) {
    return;
  }

  if (
    enElement.dataset.listenerAttached === "true" ||
    deElement.dataset.listenerAttached === "true"
  ) {
    return;
  }

  enElement?.addEventListener("click", () => {
    enElement?.classList.remove("inactive-lang");
    deElement?.classList.add("inactive-lang");
    handleLanguageSwitch("en");
  });
  enElement.dataset.listenerAttached = "true";

  deElement?.addEventListener("click", () => {
    deElement?.classList.remove("inactive-lang");
    enElement?.classList.add("inactive-lang");
    handleLanguageSwitch("de");
  });
  deElement.dataset.listenerAttached = "true";
};

document.addEventListener("astro:page-load", setupLangClickListeners);
