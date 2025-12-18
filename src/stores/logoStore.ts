import { atom } from "nanostores";

export const logoSize = atom<number>(0);

export const setLogoSize = (height: number) => {
  logoSize.set(height);
};
