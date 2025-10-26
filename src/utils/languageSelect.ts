import { setLang } from "@/stores/langStore";

export const handleLanguageSwitch = (newLang: "de" | "en") => {
  setLang(newLang);
  document.cookie = `lang=${newLang}; SameSite=None; Secure`;
  const currentPath = window.location.pathname;
  const pathSegments = currentPath.split("/");

  if (pathSegments[1] === newLang) return;

  pathSegments[1] = newLang;
  const newPath = pathSegments.join("/");

  window.location.href = newPath;
};
