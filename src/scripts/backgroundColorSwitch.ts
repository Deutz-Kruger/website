import { keywordColor } from "@/stores/keywordStore";

const applyColor = () => {
  const color = keywordColor.get();
  const body = document.getElementById("bg-col-wrapper");
  if (!body) return;
  body.style.backgroundColor = `var(${color})`;
};

keywordColor.subscribe((color) => {
  const body = document.getElementById("bg-col-wrapper");
  if (!body) return;
  body.style.backgroundColor = `var(${color})`;
});

document.addEventListener("astro:after-swap", applyColor);
