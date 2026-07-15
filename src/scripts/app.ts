import "./hls-video";
import "./preview-video";

import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import Swup from "swup";

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

const init = () => {
  if (!isInitialized) {
    initColorStore();
    isInitialized = true;
  }

  initColorSwitcher();
  initColor();
  initLenis();
  initLogoSizer();
  initLangSelect();
  initHeaderLogic();
  initLogoAnimation();
  initServices();
};

const cleanUp = () => {
  cleanUpColorSwitcher();
  cleanUpHeaderLogic();
  cleanUpLenis();
  cleanUpLogoAnimation();
  cleanUpLogoSizer();
  cleanUpLangSelect();
  cleanUpServices();
};

swup.hooks.on("page:view", init);
swup.hooks.before("content:replace", cleanUp);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
