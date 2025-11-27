# Deutz Kruger Digital Studio - Portfolio Website

## 1. Goals & Overview

> A showcase of cutting-edge web development that proves **aesthetic excellence and peak performance aren't mutually exclusive**. Built for a newly established digital agency that specializes in tastefully integrating modern technologies to create satisfying, interactive experiences that feel both fresh and sophisticated.

**Core Values Demonstrated:**

- **Performance-First Design** - Every visual effect optimized
- **Technology as Enhancement, Not Gimmick** - Three.js and GLSL used purposefully
- **Bilingual Sophistication** - Seamless EN/DE experience
- **Future-Proof Architecture** - Modern stack with maintainable structure

## 2. Technical Details

### Project Structure Architecture

**Content-First Organization:**

```
src/content/           # CMS-like content management
├── cases/             # Portfolio case studies
├── media/             # Media assets and metadata
├── pages/             # Page content definitions
└── schemas/           # Content validation schemas
```

**Component Separation:**

```
components/
├── astro/             # Astro-native components
├── react/             # Standard React components
└── r3f/              # Three.js/React Three Fiber components
```

**Technology-Driven Directories:**

```
src/shaders/           # GLSL shader files (injected via Vite)
src/stores/           # Nanostores for state management
scripts/              # Build/deployment automation
media-sync/           # Media processing pipeline
```

### Key Dependencies & Architectural Decisions

```json website/package.json
{
  "name": "deutz-krueger-portfolio",
  "private": "true",
  "type": "module",
  "version": "0.0.1",
  "author": "Marvin Deutz",
  "repository": {
    "type": "git",
    "url": "https://github.com/Deutz-Kruger/website"
  },
  "homepage": "https://deutzkrueger.de",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  },
  "scripts": {
    "dev": "git pull && astro dev",
    "build": "astro build",
    "preview": "astro build && wrangler dev",
    "deploy-cf": "pnpm astro build && pnpm wrangler deploy",
    "astro": "astro",
    "lint": "eslint . --ext .js,.ts,.astro",
    "lint:fix": "eslint . --ext .js,.ts,.astro --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "astro check",
    "prepare": "husky",
    "sync-media": "git pull && tsx ./media-sync/sync.ts",
    "admin": "tsx ./admin-dashboard/server.ts",
    "reset:cache": "rm -rf .astro .cache .wrangler dist"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.6.10",
    "@astrojs/react": "^4.4.0",
    "@nanostores/persistent": "^1.2.0",
    "@react-three/drei": "^10.7.6",
    "@react-three/fiber": "^9.4.0",
    "@tailwindcss/vite": "^4.1.16",
    "@thi.ng/color": "^5.8.0",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "astro": "^5.15.1",
    "astro-useragent": "^5.2.0",
    "clsx": "^2.1.1",
    "glob": "^11.0.3",
    "hls.js": "^1.6.13",
    "leva": "^0.10.0",
    "nanostores": "^1.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "swiper": "^12.0.3",
    "tailwind-merge": "^3.3.1",
    "tailwindcss": "^4.1.16",
    "three": "^0.180.0"
  },
  "devDependencies": {
    "@astrojs/sitemap": "^3.6.0",
    "@eslint/js": "^9.38.0",
    "@hono/node-server": "^1.19.5",
    "@thi.ng/math": "^5.13.4",
    "@thi.ng/vectors": "^8.6.11",
    "@types/ffprobe": "^1.1.8",
    "@types/ffprobe-static": "^2.0.3",
    "@types/three": "^0.180.0",
    "astro-robots-txt": "^1.0.0",
    "astro-seo": "^0.8.4",
    "dotenv": "^17.2.3",
    "eslint": "^9.38.0",
    "eslint-plugin-astro": "^1.4.0",
    "eslint-plugin-eslint-comments": "^3.2.0",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "eslint-plugin-prettier": "^5.5.4",
    "eslint-plugin-simple-import-sort": "^12.1.1",
    "ffprobe": "^1.1.2",
    "ffprobe-static": "^3.1.0",
    "globals": "^16.4.0",
    "glsl-noise": "^0.0.0",
    "glslify": "^7.1.1",
    "hono": "^4.10.3",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.6",
    "prettier": "^3.6.2",
    "prettier-plugin-astro": "^0.14.1",
    "prettier-plugin-tailwindcss": "^0.6.14",
    "sharp": "^0.34.4",
    "sonda": "^0.9.0",
    "tsx": "^4.20.6",
    "typescript-eslint": "^8.46.2",
    "vite": "^7.1.12",
    "vite-plugin-glslify-inject": "^1.1.2",
    "wrangler": "^4.45.0",
    "xxhash-wasm": "^1.1.0",
    "zod": "^4.1.12"
  }
}
```

**Core Framework:** `Astro 5.15.1`

- **Reason:** Islands architecture for optimal performance - interactive React components only where needed
- **React integration** for complex UI components without paying the full React SSR cost
- **TypeScript-first** approach with strict configuration

**3D Graphics Stack:**

- `@react-three/fiber` + `@react-three/drei` + `three`
- **Purpose:** Showcase cutting-edge web capabilities in portfolio
- **Performance approach:** Isolated 3D components to prevent unnecessary re-renders

**Styling & Design:**

- `TailwindCSS 4.1.16` with `@tailwindcss/vite`
- **Approach:** Utility-first with custom design system
- **Performance:** Vite integration for optimized CSS generation

**Media Pipeline:**

- `Sharp` for metadata extraction
- Custom image service entrypoint (`src/utils/images-service.ts`)
- Media synchronization scripts (`media-sync/`)
- **Purpose:** Professional-grade media handling for portfolio quality

**Deployment & Infrastructure:**

- `@astrojs/cloudflare` with Wrangler
- **Platform proxy** for local development simulation
- **Build optimization** with sourcemap disabled for production

### Deployment Pipeline

**Development Workflow:**

```bash
pnpm dev    # Local development with git sync
pnpm build  # Production build
pnpm preview # Preview with Wrangler
```

**Preview Deployment:**

```bash
pnpm deploy-cf  # Build + Wrangler deploy to Cloudflare
```

**CI/CD Features:**

- **Git-based development** (`git pull` in dev script)
- **Environment-aware robots.txt** (disallow in dev, allow in production)
- **Local cache management** (`.cache/wrangler/v3` persistence)

**Performance Optimizations:**

- **SSR externalization** of Node modules
- **Vite plugin system** for shader injection and alias resolution
- **Platform proxy** for seamless local/remote parity
