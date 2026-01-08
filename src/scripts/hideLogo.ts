import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { throttle } from "@/utils/throttle";

gsap.registerPlugin(ScrollTrigger);

let logoContainer: HTMLElement | null = null;
let logoElement: HTMLElement | null = null;
let isLogoObscured = false;
let checkOverlapThrottled: (() => void) | null = null;

const BLUR_AMOUNT = 4; // Pixels
const SCALE_AMOUNT = 0.8; // Factor
const ANIMATION_DURATION = 0.2;

/**
 * Checks if a text element from the main content is overlapping the fixed logo.
 * This function is throttled to improve performance.
 */
function checkOverlap() {
  if (!logoContainer || !logoElement) return;

  const logoRect = logoContainer.getBoundingClientRect();

  // Get a point near the center of the logo for element detection on the x axis
  const x = logoRect.left + logoRect.width / 2;

  // Get a point at the top and bottom of the logo for the detection.
  const y_bottom = logoRect.bottom - logoRect.height / 6;
  const y_top = logoRect.top + logoRect.height / 2;

  const isObscuredAt = (y: number): boolean => {
    const elementsAtPoint = document.elementsFromPoint(x, y);
    const obscuringElement = elementsAtPoint.find((el) => {
      const isMainContent =
        el.closest("#swup") === document.getElementById("swup");
      const isTextLike =
        el.tagName === "P" ||
        el.tagName === "H1" ||
        el.tagName === "H2" ||
        el.tagName === "H3" ||
        el.tagName === "H4" ||
        el.tagName === "H5" ||
        el.tagName === "H6" ||
        el.tagName === "SPAN";
      const isNotLogo = !el.closest("#fixed-logo-container");
      const computedStyle = window.getComputedStyle(el);
      const isVisible =
        computedStyle.opacity !== "0" && computedStyle.visibility !== "hidden";
      return isMainContent && isTextLike && isNotLogo && isVisible;
    });
    return !!obscuringElement;
  };

  const isCurrentlyObscured = isObscuredAt(y_top) || isObscuredAt(y_bottom);

  if (isCurrentlyObscured) {
    if (!isLogoObscured) {
      gsap.to(logoElement, {
        duration: ANIMATION_DURATION,
        filter: `blur(${BLUR_AMOUNT}px)`,
        scale: SCALE_AMOUNT,
        ease: "power2.out",
      });
      isLogoObscured = true;
    }
  } else {
    if (isLogoObscured) {
      // Logo is becoming visible again
      gsap.to(logoElement, {
        duration: ANIMATION_DURATION,
        filter: "blur(0px)",
        scale: 1,
        ease: "power2.out",
      });
      isLogoObscured = false;
    }
  }
}

/**
 * Initializes the logo animation by setting up the scroll listener.
 */
export function initLogoAnimation() {
  logoContainer = document.getElementById("fixed-logo-container");
  if (!logoContainer) {
    console.warn(
      "Fixed logo container not found. Animation will not initialize.",
    );
    return;
  }
  logoElement = logoContainer.querySelector("a"); // Assuming the 'a' tag within is the animated element

  // Initial / base state
  gsap.set(logoElement, { filter: "blur(0px)", scale: 1 });

  checkOverlapThrottled = throttle(checkOverlap, 100);

  window.addEventListener("scroll", checkOverlapThrottled);
  window.addEventListener("resize", checkOverlapThrottled);
  checkOverlapThrottled(); // Initial check
}

/**
 * Cleans up the logo animation by removing the scroll listener.
 */
export function cleanUpLogoAnimation() {
  if (checkOverlapThrottled) {
    window.removeEventListener("scroll", checkOverlapThrottled);
    window.removeEventListener("resize", checkOverlapThrottled);
  }
  // Reset state
  isLogoObscured = false;
  // Ensure logo is reset if animation was active (e.g., during swup transition)
  if (logoElement) {
    gsap.to(logoElement, {
      duration: 0.3,
      filter: "blur(0px)",
      scale: 1,
      ease: "power2.out",
      overwrite: true, // Ensure any ongoing animation is stopped
    });
  }
  logoContainer = null;
  logoElement = null;
  checkOverlapThrottled = null;
}
