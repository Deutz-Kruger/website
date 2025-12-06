import { persistentAtom } from "@nanostores/persistent";

export const keywordColor = persistentAtom<string>("col", "--color-branding");

export const setKeyword = (color: string) => {
  keywordColor.set(color);
};
