# Agent Guidelines

Agent-facing documentation for the Deutz & Krüger portfolio site. Everything
here is verified against the repository; if a statement conflicts with the
code, the code wins — and this file should be updated.

For deeper detail, see [README.md](README.md) (development, media lifecycle,
deployment workflow) and [media-sync/README.md](media-sync/README.md)
(media reconciliation internals and recovery).

## What this project is

An Astro 7 site rendered as a Cloudflare Worker with static assets, deployed
via `wrangler deploy`. Server rendering is handled by `@astrojs/cloudflare`
v14, which builds through the Cloudflare Vite plugin. The site is bilingual
(`en` / `de`), with content in Astro content collections.

There is no React (or any UI framework) in the client. Interactive behavior is
framework-free TypeScript: Swup for page transitions (head + preload plugins),
GSAP, Lenis, hls.js for video, and nanostores for state.

## Requirements

- Node.js: engines require `>=22.23.4`; local development is pinned to a
  concrete version in `mise.toml`; CI runs Node 24.
- pnpm 10 or newer
- Cloudflare media credentials for the initial media sync and media changes
  (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_MEDIA_API_TOKEN` in an ignored
  `.env`). A missing generated manifest fails `astro dev` and `astro build`
  as an unresolved import; an outdated one names `pnpm sync-media`.

## Commands

```bash
# Development
pnpm dev                        # Start Astro dev server (localhost:4321)
pnpm preview                    # Build, then serve the Worker via astro preview (workerd)

# Building
pnpm build                      # astro build + performance budget + build verification

# Checks (run before committing)
pnpm check                      # ESLint + Prettier check + astro check
pnpm lint / lint:fix            # ESLint on .js, .ts, .astro
pnpm format / format:check      # Prettier
pnpm type-check                 # astro check

# Tests (Node built-in test runner via tsx; no frontend test framework)
pnpm test                       # unit tests + media tests
pnpm test:unit                  # ./test/*.test.ts
pnpm test:media                 # ./media-sync/**/*.test.ts

# Media (see media-sync/README.md before destructive commands)
pnpm sync-media                 # Reconcile local media with Cloudflare; writes manifest
pnpm sync-media:prune           # Mark/delete stale managed media after a successful deploy

# Utilities
pnpm reset:cache                # Clear .astro, .cache, .wrangler, dist
pnpm perf:budget                # Performance budget report (also runs in build)
pnpm verify:build               # Post-build HTML/SEO assertions on dist
```

## Build output and deployment

`astro build` produces `dist/client` (static assets) and `dist/server`
(bundled Worker + a generated `dist/server/wrangler.json`). That generated
config is the only valid deploy target:

```bash
wrangler deploy --config dist/server/wrangler.json
```

The root `wrangler.jsonc` is the build-time source configuration consumed by
the adapter. Do **not** run `wrangler deploy` or `wrangler dev` against it —
its `main` entrypoint is a bare package specifier that wrangler cannot resolve
outside the Vite build.

Deployment runs through `.github/workflows/build.yml`: manual runs are
preview-only Worker versions; pushes to `main` deploy to production and then
prune stale managed media. Details, including secrets and preview validation,
are in README.md.

## Media pipeline

Sources live in `src/content/media` (PNG, JPG/JPEG, SVG, MP4, WebM).
`pnpm sync-media` reconciles them against Cloudflare Images and Stream
(`sourcePath` + SHA-256 tagged), writes the generated, ignored
`src/generated/media-manifest.json`, and never deletes media. Normal sync is
fail-closed and idempotent. The runtime consumes the manifest via
`src/utils/media.ts`; no media processing happens in the deployed Worker.

## Project structure

```text
.github/workflows/build.yml     Preview + production deployment workflow
astro.config.mjs                Astro config: i18n, adapter, sitemap, robots
wrangler.jsonc                  Build-time source config for the adapter
media-sync/                     Cloudflare reconciliation CLI + tests
scripts/                        performance-budget.mjs, verify-build.mjs
test/                           Unit tests (security, locale, motion, seo, video)
src/components/astro/           All components (.astro only): UI, blocks/, util/
src/content/                    Collections: cases, pages, media, settings
src/content/schemas/            Zod schemas (blocks, pages, fields, settings)
src/generated/                  media-manifest.json (generated, ignored)
src/layouts/                    SiteLayout.astro
src/styles/global.css           Global styles (Tailwind CSS 4)
src/utils/                      Runtime helpers (media, cn, locale, motion, …)
```

## Code Style

### Imports

- Path aliases (tsconfig.json): `@/*`, `@components/*`, `@content/*`,
  `@layouts/*`, `@styles/*`
- Imports are auto-sorted by `simple-import-sort/imports`; group external
  libraries first, then internal, then relative.

### Formatting (Prettier)

- Semi-colons: `true`; trailing commas: `all`; print width: `80`; tab width: `2`
- Astro files use the `astro` parser; JSONC uses `none` for trailing commas
- Tailwind classes are sorted automatically

### TypeScript

- Strict mode (extends `astro/tsconfigs/strict`)
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- JSX: `react-jsx` with import source `react` (config only; no React in use)
- `noUnusedLocals: false`; `skipLibCheck: true`

### Naming Conventions

- **Components**: PascalCase (e.g., `FixedLogo`, `CasePreview`)
- **Functions/Variables**: camelCase (e.g., `generateKeywords`)
- **Constants**: UPPER_SNAKE_CASE for exported config
- **Types/Interfaces**: PascalCase (e.g., `LayoutData`, `Manifest`)
- **Schemas**: lowercase camelCase zod schemas (e.g., `textBlock`, `blocksUnion`)

### Astro Components

- Frontmatter with `---` delimiters; destructure `Astro.props` immediately
- Type props with `interface Props { }` or infer from zod schemas
- Use `class` (not `className`) for HTML elements
- Use `set:html` only for trusted content

### Error Handling

- try/catch for async operations; log with `console.error()` / `console.warn()`
- Type-guard unknown errors (e.g., `isErrorWithCode(error)`)
- Return early or throw errors with meaningful context

### Schemas (Zod)

- Define schemas in `src/content/schemas/`
- Use discriminated unions (`z.discriminatedUnion()`) for block types
- Export both schemas and inferred types:
  `export type TextBlock = z.infer<typeof textBlock>;`

### ESLint Notes

- `simple-import-sort/imports` and `/exports`: error level
- `prettier/prettier` rule disabled (Prettier runs separately)
- No unused eslint disable/enable comments
- `@typescript-eslint/no-explicit-any`: off in `.astro` files

### Pre-Commit Hooks

Husky runs `lint-staged` on pre-commit:

- Type check on `.ts`, `.tsx`, `.astro` files
- ESLint fix + Prettier on code files
- Prettier format on markdown, JSON, YAML, CSS
