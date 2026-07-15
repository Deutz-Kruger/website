import { gsap } from "gsap";
import Lenis from "lenis";

let lenis: Lenis | null = null;
let lenisUpdateCallback: ((time: number) => void) | null = null;

/**
 * Initializes smooth scrolling with Lenis on GSAP's shared ticker.
 */
export const initLenis = () => {
  if (lenis) return;

  lenis = new Lenis({
    lerp: 0.12,
    autoRaf: false,
  });

  // Define the function to be called on every GSAP tick.
  lenisUpdateCallback = (time: number) => {
    lenis?.raf(time * 1000);
  };

  gsap.ticker.add(lenisUpdateCallback);

  gsap.ticker.lagSmoothing(0);
};

/**
 * Cleans up the Lenis instance and GSAP ticker for page transitions.
 */
export const cleanUpLenis = () => {
  if (lenisUpdateCallback) {
    gsap.ticker.remove(lenisUpdateCallback);
    lenisUpdateCallback = null;
  }
  if (lenis) {
    lenis.destroy();
    lenis = null;
  }
};
