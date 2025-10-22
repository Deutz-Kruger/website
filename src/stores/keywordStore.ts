import { persistentAtom } from "@nanostores/persistent";

export const keywordColor = persistentAtom<string>("col", "--color-blue");

export const setKeyword = (color: string) => {
  keywordColor.set(color);
};
