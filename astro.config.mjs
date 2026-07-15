// @ts-check
import { fileURLToPath, URL } from "node:url";

import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import robotsTxt from "astro-robots-txt";
import { loadEnv } from "vite";

const { APP_ENV } = loadEnv(
  process.env.NODE_ENV || "development",
  process.cwd(),
  "",
);

// https://astro.build/config
export default defineConfig({
  site: "https://deutzkrueger.de",
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
      filter: (page) => new URL(page).pathname !== "/",
      priority: 0.7,
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en-US",
          de: "de-DE",
        },
      },
    }),
    robotsTxt({
      policy:
        APP_ENV === "production"
          ? [{ userAgent: "*", allow: "/" }]
          : [{ userAgent: "*", disallow: "/" }],
    }),
  ],
  vite: {
    plugins: [
      // @ts-expect-error Compat issues with vite 7 and plugin typing
      tailwindcss(),
    ],

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
