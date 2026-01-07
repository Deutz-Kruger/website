import { throttle } from "@/utils/throttle";

const elements = Array.from(document.getElementsByClassName("hide-me"));
let lastScrollPos = 0;

let isHidden = false;
let hidePos = 0;

let throttledScrollHandler: (() => void) | null = null;

export const initHeaderLogic = () => {
  if (throttledScrollHandler) return;

  throttledScrollHandler = throttle(renderHeader, 50);
  window.addEventListener("scroll", throttledScrollHandler, true);
};

export const cleanUpHeaderLogic = () => {
  if (throttledScrollHandler) {
    window.removeEventListener("scroll", throttledScrollHandler, true);
    throttledScrollHandler = null;
  }
};

const renderHeader = () => {
  const windowY = window.scrollY;

  const threshold = 200;
  const deadZone = 10; // Pixels to scroll up before showing

  if (!elements.length) return;

  if (windowY <= threshold) {
    // Below threshold: always show
    if (isHidden) {
      elements.forEach((element) => {
        element.classList.remove("hide");
        element.classList.add("scroll-up");
      });
      isHidden = false;
    }
  } else {
    // Above threshold: handle direction with hysteresis
    if (windowY > lastScrollPos) {
      // Scrolling down: hide immediately
      if (!isHidden) {
        elements.forEach((element) => {
          element.classList.add("hide");
          element.classList.remove("scroll-up");
        });
        isHidden = true;
        hidePos = windowY;
      }
    } else {
      if (isHidden && windowY < hidePos - deadZone) {
        elements.forEach((element) => {
          element.classList.remove("hide");
          element.classList.add("scroll-up");
        });
        isHidden = false;
      }
      hidePos = lastScrollPos;
    }
  }

  lastScrollPos = windowY;
};
