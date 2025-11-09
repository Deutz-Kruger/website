// @ts-check
import { fileURLToPath, URL } from "node:url";

import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import robotsTxt from "astro-robots-txt";
// import Sonda from "sonda/astro";
import { loadEnv } from "vite";
import glsl from "vite-plugin-glslify-inject";

const { SITE_URL, APP_ENV } = loadEnv(
  process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);

// https://astro.build/config
export default defineConfig({
  site: SITE_URL || "https://deutzkrueger.de",
  i18n: {
    locales: ["en", "de"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      changefreq: "monthly",
      priority: 0.7,
      lastmod: new Date(),
    }),
    robotsTxt({
      policy:
        APP_ENV === "production"
          ? [{ userAgent: "*", allow: "/" }]
          : [{ userAgent: "*", disallow: "/" }],
    }),
    react(),
    // Sonda(),
  ],
  vite: {
    plugins: [
      // @ts-expect-error Compat issues with vite 7 and plugin typing
      glsl({
        include: "./src/shaders/**/*.(vert|frag|glsl)",
        exclude: "node_modules/**",
        types: { alias: "@shaders", library: "threejs" },
      }),
      // @ts-expect-error Compat issues with vite 7 and plugin typing
      tailwindcss(),
    ],
    optimizeDeps: {
      exclude: ["vite-plugin-glslify-inject/injectConstants"],
      include: [
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "leva",
        "@thi.ng/color",
        "@thi.ng/math",
        "@thi.ng/vectors",
      ],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@shaders": "/src/shaders/",
      },
    },
    ssr: {
      external: ["node:path", "node:crypto", "node:fs/promises", "node:url"],
    },
    server: {
      watch: {
        ignored: [
          "**/*.astro.tsx",
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/.astro/**",
          "**/src/content/media/**/*.{mp4,webm,mov}", // Ignore video files
        ],
      },
      fs: {
        strict: false,
      },
    },
    build: {
      sourcemap: false,
    },
  },
  adapter: cloudflare({
    imageService: "custom",
    platformProxy: {
      enabled: true,
      configPath: "wrangler.jsonc",
      persist: {
        path: "./.cache/wrangler/v3",
      },
    },
  }),
  image: {
    service: {
      entrypoint: fileURLToPath(
        new URL("./src/utils/images-service.ts", import.meta.url),
      ),
    },
  },
});
