import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { throttle } from "@/utils/throttle"; // Assuming throttle is fixed and ready

gsap.registerPlugin(ScrollTrigger);

let logoContainer: HTMLElement | null = null;
let logoElement: HTMLElement | null = null; // Assuming the actual image or interactive part is inside
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

  // Get a point near the center of the logo for element detection
  const x = logoRect.left + logoRect.width / 2;
  const y = logoRect.bottom - logoRect.height / 6;

  // Get all elements at this point
  const elementsAtPoint = document.elementsFromPoint(x, y);

  // Filter for elements that are descendants of <main id="swup"> and are text-like
  // We need to ensure these elements are actually obscuring the logo
  const obscuringElement = elementsAtPoint.find((el) => {
    // Check if it's a descendant of main#swup
    const isMainContent =
      el.closest("#swup") === document.getElementById("swup");
    // Check if it's a block-level or text-containing element (adjust as needed)
    const isTextLike =
      el.tagName === "P" ||
      el.tagName === "H1" ||
      el.tagName === "H2" ||
      el.tagName === "H3" ||
      el.tagName === "H4" ||
      el.tagName === "H5" ||
      el.tagName === "H6" ||
      el.tagName === "SPAN"; // Add more tags as necessary

    // Ensure it's not the logo itself or its parent container
    const isNotLogo = !el.closest("#fixed-logo-container");

    // Make sure it's visually solid (not fully transparent)
    const computedStyle = window.getComputedStyle(el);
    const isVisible =
      computedStyle.opacity !== "0" && computedStyle.visibility !== "hidden";

    // Check if its z-index is higher than the logo's (logo is z-index: 5)
    // This is more complex than a direct check, as 'static' elements don't have effective z-index.
    // Instead, rely on elementsFromPoint order and main content being 'on top' of logo.

    return isMainContent && isTextLike && isNotLogo && isVisible;
  });

  console.log("obscuringElemen", obscuringElement);

  if (obscuringElement) {
    if (!isLogoObscured) {
      // Logo is becoming obscured
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
  console.log("Initializing logo animation.");
  logoContainer = document.getElementById("fixed-logo-container");
  if (!logoContainer) {
    console.warn(
      "Fixed logo container not found. Animation will not initialize.",
    );
    return;
  }
  logoElement = logoContainer.querySelector("a"); // Assuming the 'a' tag within is the animated element

  // Ensure initial state
  gsap.set(logoElement, { filter: "blur(0px)", scale: 1 });

  // Create a throttled version of checkOverlap
  checkOverlapThrottled = throttle(checkOverlap, 100); // Throttle to every 100ms

  // Add event listener
  window.addEventListener("scroll", checkOverlapThrottled);
  window.addEventListener("resize", checkOverlapThrottled); // Also check on resize
  checkOverlapThrottled(); // Initial check
}

/**
 * Cleans up the logo animation by removing the scroll listener.
 */
export function cleanupLogoAnimation() {
  console.log("Cleaning up logo animation.");
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
