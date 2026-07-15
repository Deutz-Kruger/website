# Project: Deutz & Krüger Portfolio

## Project Overview

This is the portfolio website for Deutz & Krüger, a digital agency specializing in web development and design. The website is a statically generated site built with Astro, showcasing their projects and services. It is designed to be fast, modern, and easily deployable to Cloudflare Pages. The site supports both English and German languages.

### Key Technologies

- **Framework**: [Astro](https://astro.build/)
- **UI Components**: Astro components with framework-free client scripts and custom elements for interactive behavior.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Languages**: TypeScript and JavaScript
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Content Management**: Astro's content collections are used to manage text and media content.

### Architecture

- **Static Site Generation (SSG)**: Astro is used to build a static website, which is fast and SEO-friendly.
- **Component-Based**: The UI is built with `.astro` components and framework-free TypeScript.
- **Internationalization (i18n)**: The site supports English and German, with content organized accordingly.
- **Content Collections**: Data for pages, cases, and layout is managed through Astro's content collections in the `src/content` directory.
- **Cloudflare Integration**: The project is configured to deploy to Cloudflare Pages, with a custom image service for optimizing images.

## Building and Running

### Prerequisites

- Node.js (version 20.0.0 or higher)
- pnpm (version 10.0.0 or higher)

### Development

To start the local development server:

```bash
pnpm install
pnpm dev
```

The site will be available at `http://localhost:4321`.

### Building

To build the site for production:

```bash
pnpm build
```

The output will be in the `dist/` directory.

### Previewing the Build

To preview the production build locally:

```bash
pnpm preview
```

This command first builds the project and then uses Cloudflare's `wrangler` to serve it.

### Deployment

To deploy the website to Cloudflare Pages:

```bash
pnpm deploy-cf
```

This script builds the project and then deploys it using `wrangler`.

## Development Conventions

- **Linting**: ESLint is configured to enforce code quality. Run `pnpm lint` to check for issues and `pnpm lint:fix` to automatically fix them.
- **Formatting**: Prettier is used for code formatting. Run `pnpm format` to format the entire codebase.
- **Type Checking**: TypeScript is used for type safety. Run `pnpm type-check` to check for type errors.
- **Pre-Commit Hooks**: Husky and lint-staged are set up to automatically lint and format files before committing.
- **Media Synchronization**: `media-sync/cli.ts` reconciles local media with tagged Cloudflare Images and Stream inventory. Run it with `pnpm sync-media`.
- **Content Management**: All content is managed in the `src/content` directory. The structure and schema for the content are defined in `src/content/schemas`.
- **Styling**: Use Tailwind CSS utility classes for styling. Global styles are in `src/styles/global.css`.
