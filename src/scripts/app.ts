import "./hls-video";
import "./preview-video";

import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import Swup from "swup";

import { getLocaleFromPath } from "@/utils/locale";
import { prefersReducedMotion, subscribeToReducedMotion } from "@/utils/motion";

import {
  cleanUpColorSwitcher,
  initColor,
  initColorStore,
  initColorSwitcher,
} from "./backgroundColorSwitch";
import { cleanUpHeaderLogic, initHeaderLogic } from "./headerLogic";
import { cleanUpLogoAnimation, initLogoAnimation } from "./hideLogo";
import {
  cleanUpLangSelect,
  initLangSelect,
  setSwupInstance,
} from "./languageSelect";
import { cleanUpLenis, initLenis } from "./lenis";
import { cleanUpLogoSizer, initLogoSizer } from "./logoSizer";
import { cleanUpServices, initServices } from "./services";

const swup = new Swup({
  plugins: [
    new SwupPreloadPlugin({ preloadInitialPage: false }),
    new SwupHeadPlugin({
      persistAssets: true,
      persistTags: "style, link[rel=stylesheet]",
    }),
  ],
  containers: ["#swup"],
  cache: true,
  animationSelector: '[class*="transition-"]',
});

setSwupInstance(swup);

let isInitialized = false;
let isPageActive = false;
let reducedMotion = prefersReducedMotion();

const syncMotionAwareFeatures = () => {
  if (!isPageActive) return;

  if (reducedMotion) {
    cleanUpLenis();
    cleanUpHeaderLogic();
    return;
  }

  initLenis();
  initHeaderLogic();
};

subscribeToReducedMotion((shouldReduceMotion) => {
  const preferenceChanged = reducedMotion !== shouldReduceMotion;
  reducedMotion = shouldReduceMotion;

  if (preferenceChanged) {
    syncMotionAwareFeatures();
  }
});

const syncDocumentLocale = () => {
  const locale = getLocaleFromPath(window.location.pathname);
  if (locale) {
    document.documentElement.lang = locale;
  }
};

const init = () => {
  if (!isInitialized) {
    initColorStore();
    isInitialized = true;
  }

  syncDocumentLocale();
  initColorSwitcher();
  initColor();
  if (!reducedMotion) initLenis();
  initLogoSizer();
  initLangSelect();
  if (!reducedMotion) initHeaderLogic();
  initLogoAnimation();
  initServices();
  isPageActive = true;
};

const cleanUp = () => {
  isPageActive = false;
  cleanUpColorSwitcher();
  cleanUpHeaderLogic();
  cleanUpLenis();
  cleanUpLogoAnimation();
  cleanUpLogoSizer();
  cleanUpLangSelect();
  cleanUpServices();
};

swup.hooks.on("page:view", init);
swup.hooks.on("visit:start", (visit) => {
  if (reducedMotion) {
    visit.animation.animate = false;
  }
});
swup.hooks.before("content:replace", cleanUp);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
