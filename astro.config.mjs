// @ts-check
import { fileURLToPath, URL } from "node:url";

import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import robotsTxt from "astro-robots-txt";
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
      redirectToDefaultLocale: true,
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
        ignored: ["**/*.astro.tsx"],
      },
    },
  },
  adapter: cloudflare({
    imageService: "passthrough",
    platformProxy: {
      enabled: true,
      configPath: "wrangler.jsonc",
      persist: {
        path: "./.cache/wrangler/v3",
      },
    },
  }),
});
