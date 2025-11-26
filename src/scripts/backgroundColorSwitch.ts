import { keywordColor, setKeyword } from "@/stores/keywordStore";

export const addColorSwitcher = () => {
  const keywordElements = document.querySelectorAll(".keyword");

  keywordElements.forEach((el) => {
    const element = el as HTMLElement;
    if (element.dataset.color) {
      el.addEventListener("click", () => {
        if (!element.dataset.color) return;
        setKeyword(element.dataset.color);
      });
    }
  });
};

export const applyColor = () => {
  const color = keywordColor.get();
  const body = document.getElementById("bg-col-wrapper");
  if (!body) return;
  body.style.backgroundColor = `var(${color})`;
  document.body.style.setProperty(
    "--swup-overlay-theme-color",
    `var(${color})`,
  );
};

keywordColor.subscribe((color) => {
  const body = document.getElementById("bg-col-wrapper");
  if (!body) return;
  body.style.backgroundColor = `var(${color})`;
  document.body.style.setProperty(
    "--swup-overlay-theme-color",
    `var(${color})`,
  );
});
