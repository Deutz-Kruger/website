import { navigate } from "astro:transitions/client";

import { langSelection, setLang } from "@/stores/langStore";

const handleLanguageSwitch = (newLang: "de" | "en") => {
  console.log("New Lang", newLang);
  setLang(newLang);
  document.cookie = `lang=${newLang}; SameSite=None; Secure`;
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");

  if (pathSegments[1] === newLang) return;

  pathSegments[1] = newLang;
  const newPath = pathSegments.join("/");

  navigate(newPath);
};

const syncLanguageWithUrl = () => {
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");
  const currentLang = pathSegments[1];

  if (currentLang === "en" || currentLang === "de") {
    const storedLang = langSelection.get();
    if (storedLang !== currentLang) {
      console.log("Syncing language store with URL:", currentLang);
      setLang(currentLang);
    }
  }
};

export const setupLangSelect = () => {
  syncLanguageWithUrl();
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  console.log("enElement", enElement);
  console.log("deElement", deElement);

  const lang = langSelection.get();

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
  console.log("Listeners Setup");
};

export const cleanupLangSelect = () => {
  const enElement = document.getElementById("en");
  const deElement = document.getElementById("de");

  if (!enElement || !deElement) {
    return;
  }

  deElement.removeEventListener("click", () => {
    deElement?.classList.remove("inactive-lang");
    enElement?.classList.add("inactive-lang");
    handleLanguageSwitch("de");
  });

  deElement.dataset.listenerAttached = "false";

  enElement?.removeEventListener("click", () => {
    enElement?.classList.remove("inactive-lang");
    deElement?.classList.add("inactive-lang");
    handleLanguageSwitch("en");
  });

  enElement.dataset.listenerAttached = "false";
};
