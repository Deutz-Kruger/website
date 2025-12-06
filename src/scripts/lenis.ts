import Lenis from "lenis";

let lenis: Lenis | null = null;

export const initLenis = () => {
  // Initialize Lenis
  lenis = new Lenis({
    autoRaf: true,
    duration: 0.6,
    easing: (t) => 1 - (1 - t) * (1 - t),
  });

  // Listen for the scroll event and log the event data
  lenis.on("scroll", (e) => {
    console.log(e);
  });
};

export const cleanupLenis = () => {
  if (lenis) {
    lenis.destroy();
  }
};
