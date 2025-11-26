import "./hls-video";

import SwupDebugPlugin from "@swup/debug-plugin";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import Swup from "swup";

import { cleanUpCarousel, initCarousel } from "@/scripts/carousel";

import { addColorSwitcher, applyColor } from "./backgroundColorSwitch";

const swup = new Swup({
  plugins: [
    new SwupPreloadPlugin(),
    new SwupHeadPlugin({
      persistAssets: true, // Keep existing CSS/JS, add new ones
      persistTags: "style, link[rel=stylesheet]", // Don't remove existing styles
    }),
    new SwupScriptsPlugin({}),
    new SwupDebugPlugin(),
  ],
  containers: ["#swup"],
});

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
  addColorSwitcher();
  applyColor();
  initCarousel();
};

const cleanUp = () => {
  cleanUpCarousel();
};
