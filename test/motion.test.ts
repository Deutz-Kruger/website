import assert from "node:assert/strict";
import test from "node:test";

import {
  type MatchMedia,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  shouldLoadMotionVideo,
  subscribeToReducedMotion,
} from "../src/utils/motion";

class FakeMediaQueryList {
  matches = false;
  readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  addEventListener(
    type: string,
    listener: (event: MediaQueryListEvent) => void,
  ) {
    if (type === "change") this.listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: MediaQueryListEvent) => void,
  ) {
    if (type === "change") this.listeners.delete(listener);
  }

  setMatches(matches: boolean) {
    this.matches = matches;
    const event = { matches } as MediaQueryListEvent;
    this.listeners.forEach((listener) => listener(event));
  }
}

const createMatchMedia = (mediaQuery: FakeMediaQueryList): MatchMedia =>
  ((query: string) => {
    assert.equal(query, REDUCED_MOTION_QUERY);
    return mediaQuery as unknown as MediaQueryList;
  }) satisfies MatchMedia;

test("prefersReducedMotion reports the current media-query state", () => {
  const mediaQuery = new FakeMediaQueryList();
  const matchMedia = createMatchMedia(mediaQuery);

  assert.equal(prefersReducedMotion(matchMedia), false);
  mediaQuery.matches = true;
  assert.equal(prefersReducedMotion(matchMedia), true);
});

test("subscribeToReducedMotion reports changes and cleans up", () => {
  const mediaQuery = new FakeMediaQueryList();
  const states: boolean[] = [];
  const unsubscribe = subscribeToReducedMotion(
    (matches) => states.push(matches),
    createMatchMedia(mediaQuery),
  );

  assert.deepEqual(states, [false]);
  assert.equal(mediaQuery.listeners.size, 1);

  mediaQuery.setMatches(true);
  assert.deepEqual(states, [false, true]);

  unsubscribe();
  assert.equal(mediaQuery.listeners.size, 0);
  mediaQuery.setMatches(false);
  assert.deepEqual(states, [false, true]);
});

test("shouldLoadMotionVideo blocks loading only for reduced motion", () => {
  assert.equal(shouldLoadMotionVideo(false), true);
  assert.equal(shouldLoadMotionVideo(true), false);
});
