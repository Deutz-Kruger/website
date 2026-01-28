import "./hls-video";

import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import Swup from "swup";

import { cleanUpCarousel, initCarousel } from "@/scripts/carousel";

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
    new SwupPreloadPlugin(),
    new SwupHeadPlugin({
      persistAssets: true,
      persistTags: "style, link[rel=stylesheet]",
    }),
    new SwupScriptsPlugin({}),
    // new SwupDebugPlugin(),
  ],
  containers: ["#swup"],
  cache: true,
  animationSelector: '[class*="transition-"]',
});

// Register swup instance with languageSelect
setSwupInstance(swup);

let isInitialized = false;

swup.hooks.on("page:view", () => {
  init();
});

swup.hooks.before("content:replace", () => {
  cleanUp();
});

document.addEventListener("DOMContentLoaded", () => {
  init();
});

const init = () => {
  if (!isInitialized) {
    initColorStore();
    isInitialized = true;
  }

  initColorSwitcher();
  initColor();
  initCarousel();
  initLenis();
  initLogoSizer();
  initLangSelect();
  initHeaderLogic();
  initLogoAnimation();
  initServices();
};

const cleanUp = () => {
  cleanUpColorSwitcher();
  cleanUpCarousel();
  cleanUpHeaderLogic();
  cleanUpLenis();
  cleanUpLogoAnimation();
  cleanUpLogoSizer();
  cleanUpLangSelect();
  cleanUpServices();
};
