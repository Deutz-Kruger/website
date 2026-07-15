export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const NO_PREFERENCE_MOTION_QUERY =
  "(prefers-reduced-motion: no-preference)";

export type MatchMedia = (query: string) => MediaQueryList;
export type ReducedMotionListener = (prefersReducedMotion: boolean) => void;

const getMatchMedia = (matchMedia?: MatchMedia): MatchMedia =>
  matchMedia ?? window.matchMedia.bind(window);

/** Returns whether the user currently prefers reduced motion. */
export const prefersReducedMotion = (matchMedia?: MatchMedia): boolean =>
  getMatchMedia(matchMedia)(REDUCED_MOTION_QUERY).matches;

/** Returns whether motion-driven video loading and playback are allowed. */
export const shouldLoadMotionVideo = (prefersReducedMotion: boolean): boolean =>
  !prefersReducedMotion;

/** Subscribes to reduced-motion changes and immediately reports current state. */
export const subscribeToReducedMotion = (
  listener: ReducedMotionListener,
  matchMedia?: MatchMedia,
): (() => void) => {
  const mediaQuery = getMatchMedia(matchMedia)(REDUCED_MOTION_QUERY);
  const handleChange = (event: MediaQueryListEvent) => {
    listener(event.matches);
  };

  mediaQuery.addEventListener("change", handleChange);
  listener(mediaQuery.matches);

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
  };
};
