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

const SITEMAP_EXCLUDED_PATHS = new Set([
  "/",
  "/de/about/",
  "/en/about/",
  "/en/impressum/",
  "/en/privacy/",
]);

/** @param {string} page */
const normalizeSitemapPath = (page) => {
  const pathname = new URL(page).pathname;
  return pathname === "/" ? pathname : `${pathname.replace(/\/+$/, "")}/`;
};

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
      filter: (page) => !SITEMAP_EXCLUDED_PATHS.has(normalizeSitemapPath(page)),
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
      tailwindcss(),
      // Bundle analysis helper: ANALYZE=1 pnpm build
      ...(process.env.ANALYZE
        ? [
            (await import("sonda")).SondaVitePlugin({
              format: "json",
              open: false,
              gzip: true,
              brotli: true,
            }),
          ]
        : []),
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
      sourcemap: process.env.ANALYZE ? true : false,
    },
  },
  adapter: cloudflare({
    imageService: "custom",
    configPath: "wrangler.jsonc",
    persistState: { path: "./.cache/wrangler/v3" },
  }),
  image: {
    service: {
      entrypoint: fileURLToPath(
        new URL("./src/utils/images-service.ts", import.meta.url),
      ),
    },
  },
});
