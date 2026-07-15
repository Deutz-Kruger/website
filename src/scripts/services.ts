import { setKeyword } from "@/stores/keywordStore";

export const initServices = () => {
  const services = document.querySelectorAll<HTMLElement>(".service-card");
  snapPositions();

  window.addEventListener("resize", snapPositions);

  services.forEach((card) => {
    card.addEventListener("click", servicesClickHandler);
    card.addEventListener("mouseover", servicesHoverHandler);
    card.addEventListener("mouseleave", servicesLeaveHandler);
  });
};

export const cleanUpServices = () => {
  const services = document.querySelectorAll<HTMLElement>(".service-card");
  services.forEach((card) => {
    card.removeEventListener("click", servicesClickHandler);
    card.removeEventListener("mouseover", servicesHoverHandler);
    card.removeEventListener("mouseleave", servicesLeaveHandler);
  });
  window.removeEventListener("resize", snapPositions);
};

const servicesClickHandler = (e: Event) => {
  if (!window.matchMedia("(width >= 1024px)").matches) return;

  const clickedCard = e.currentTarget as HTMLElement;
  const cards = document.querySelectorAll<HTMLElement>(".service-card");

  if (clickedCard.classList.contains("is-active")) return;

  cards.forEach((card) => {
    card.classList.remove("is-active");
  });

  clickedCard.classList.add("is-active");

  const color = clickedCard.dataset.color;

  if (color) setKeyword(color);
};

const servicesLeaveHandler = () => {
  const cards = document.querySelectorAll<HTMLElement>(".service-card");
  cards.forEach((card) => {
    card.classList.remove("is-active");
  });
};

const servicesHoverHandler = (e: Event) => {
  if (!window.matchMedia("(width >= 1024px)").matches) return;

  const clickedCard = e.currentTarget as HTMLElement;
  const cards = document.querySelectorAll<HTMLElement>(".service-card");

  if (clickedCard.classList.contains("is-active")) return;

  cards.forEach((card) => {
    card.classList.remove("is-active");
  });

  clickedCard.classList.add("is-active");

  const color = clickedCard.dataset.color;

  if (color) setKeyword(color);
};

const snapPositions = () => {
  const services = document.querySelectorAll<HTMLElement>(".service-card");

  services.forEach((card) => {
    const placeholder = card.querySelector<HTMLElement>(
      ".service-placeholder-bg",
    );
    const animBG = card.querySelector<HTMLElement>(".service-animated-bg");

    if (!placeholder || !animBG) {
      console.error(`Placeholder or animatable element not found in ${card}`);
      return;
    }

    const placeholderRect = placeholder.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const offsetTop = placeholderRect.top - cardRect.top;
    const offsetLeft = placeholderRect.left - cardRect.left;

    animBG.style.width = `${placeholderRect.width}px`;
    animBG.style.height = `${placeholderRect.height}px`;
    animBG.style.left = `${offsetLeft}px`;
    animBG.style.top = `${offsetTop}px`;
  });
};
