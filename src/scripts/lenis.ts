import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let lenis: Lenis | null = null;
let lenisUpdateCallback: ((time: number) => void) | null = null;

/**
 * Initializes smooth scrolling with Lenis and integrates it with GSAP's ScrollTrigger.
 */
export const initLenis = () => {
  lenis = new Lenis({
    lerp: 0.12,
    autoRaf: false,
  });

  // Sync ScrollTrigger with Lenis' scroll updates.
  lenis.on("scroll", ScrollTrigger.update);

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
    lenis.off("scroll", ScrollTrigger.update);
    lenis.destroy();
    lenis = null;
  }
};
