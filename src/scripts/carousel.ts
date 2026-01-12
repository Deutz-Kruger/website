import "@glidejs/glide/dist/css/glide.core.min.css";
import "@glidejs/glide/dist/css/glide.theme.min.css";

import Glide, { type Options } from "@glidejs/glide";

// Type definitions for better type safety
type GlideInstance = InstanceType<typeof Glide>;
type ResizeHandler = () => void;

// Store instance in module scope for cleanUpCarousel
let glideInstance: GlideInstance | null = null;
let resizeHandler: ResizeHandler | null = null;

// Define carousel options as a constant for better maintainability
const CAROUSEL_OPTIONS: Partial<Options> = {
  type: "carousel",
  autoplay: 5000,
  animationDuration: 900,
  animationTimingFunc: "ease-in-out",
  swipeThreshold: 60,
  dragThreshold: 80,
  hoverpause: true,
  perView: 1,
  gap: 16,
};

// Mobile breakpoint constant
const MOBILE_BREAKPOINT = 768;

export const cleanUpCarousel = (): void => {
  if (glideInstance) {
    try {
      glideInstance.destroy();
    } catch (error) {
      console.warn("Error destroying carousel instance:", error);
    }
    glideInstance = null;
  }
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
};

export const initCarousel = (): void => {
  // Only initialize on mobile
  if (window.innerWidth >= MOBILE_BREAKPOINT) {
    return;
  }

  // cleanUpCarousel any existing instance first
  cleanUpCarousel();

  const glideElement = document.querySelector(".glide");
  if (!glideElement) {
    console.warn("Glide element not found - skipping initialization");
    return;
  }

  try {
    glideInstance = new Glide(".glide", CAROUSEL_OPTIONS);
    glideInstance.mount();
    console.log("Carousel initialized successfully");

    // Handle resize to destroy when switching to desktop
    resizeHandler = (): void => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        cleanUpCarousel();
      }
    };

    window.addEventListener("resize", resizeHandler);
  } catch (error) {
    console.error("Failed to initialize carousel:", error);
  }
};
