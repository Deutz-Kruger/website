import { logoSize, setLogoSize } from "@/stores/logoStore";

let isSubscribed: boolean;
let unsub: ReturnType<typeof logoSize.subscribe>;
const fixedLogo = document.getElementById("fixed-logo-container");
const resizeHandler = () => setSize();

export const initLogoSizer = () => {
  setSize();
  initLogoSizerSubscription();
  window.addEventListener("resize", resizeHandler);
};

export const cleanUpLogoSizer = () => {
  window.removeEventListener("resize", resizeHandler);
  if (isSubscribed) {
    unsub();
    isSubscribed = false;
  }
};

const setSize = () => {
  if (!fixedLogo) {
    console.error("Logo element could not be fetched.");
    return;
  }
  const height = fixedLogo.getBoundingClientRect().height;
  setLogoSize(height);
};

const initLogoSizerSubscription = () => {
  if (isSubscribed) return;

  unsub = logoSize.subscribe((size) => {
    const elementCollection = document.querySelectorAll<HTMLElement>(".navbar");
    const elements = Array.from(elementCollection);

    elements.forEach((element) => {
      element.style.height = `${size}px`;
    });
  });

  isSubscribed = true;
};
