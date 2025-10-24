import { persistentAtom } from "@nanostores/persistent";

export const langSelection = persistentAtom<string>("lang", "en");

export const setLang = (lang: string) => {
  langSelection.set(lang);
};
