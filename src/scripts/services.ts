export const initServices = () => {
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

    const matchesScreen = window.matchMedia("(width >= 1024px)").matches;

    if (matchesScreen) {
      card.addEventListener("click", servicesClickHandler);
    }
  });
};

const servicesClickHandler = (e: Event) => {
  const clickedCard = e.currentTarget as HTMLElement;
  const cards = document.querySelectorAll<HTMLElement>(".service-card");

  if (clickedCard.classList.contains("is-active")) return;

  cards.forEach((card) => {
    card.classList.remove("is-active");
  });
  console.log("class removed");

  clickedCard.classList.add("is-active");
  console.log("class added");
};
