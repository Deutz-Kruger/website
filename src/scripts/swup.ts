import "./hls-video";

import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import Swup from "swup";

import { cleanUpCarousel, initCarousel } from "@/scripts/carousel";

import {
  addColorSwitcher,
  applyColor,
  initColorStore,
  removeColorSwitcher,
} from "./backgroundColorSwitch";
import { cleanUpHeaderLogic, initHeaderLogic } from "./headerLogic";

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
    initColorStore(); // Only subscribe once
    isInitialized = true;
  }

  addColorSwitcher();
  applyColor();
  initCarousel();
  initHeaderLogic();
};

const cleanUp = () => {
  removeColorSwitcher();
  cleanUpCarousel();
  cleanUpHeaderLogic();
};
