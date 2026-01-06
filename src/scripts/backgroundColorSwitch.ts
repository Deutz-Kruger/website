import { keywordColor, setKeyword } from "@/stores/keywordStore";

let isSubscribed = false;

const addedListeners = new Map<HTMLElement, () => void>();

export const addColorSwitcher = () => {
  const keywordElements = document.querySelectorAll(".keyword");

  keywordElements.forEach((el) => {
    const element = el as HTMLElement;

    if (addedListeners.has(element)) return;

    if (element.dataset.color) {
      const handler = () => {
        setKeyword(element.dataset.color!);
      };

      el.addEventListener("click", handler);
      addedListeners.set(element, handler);
    }
  });
};

export const removeColorSwitcher = () => {
  addedListeners.forEach((handler, element) => {
    element.removeEventListener("click", handler);
  });
  addedListeners.clear();
};

export const applyColor = () => {
  const color = keywordColor.get();
  document.documentElement.style.setProperty("--theme-color", `var(${color})`);
};

export const initColorStore = () => {
  if (isSubscribed) return;

  keywordColor.subscribe((color) => {
    document.documentElement.style.setProperty(
      "--theme-color",
      `var(${color})`,
    );
  });

  isSubscribed = true;
};
