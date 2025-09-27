# Astro Template Deutz & Krüger

A template built with Astro, SEO, and Tailwind CSS.

Heavely base on [alipiry/astro-starter](https://github.com/alipiry/astro-starter)

Linting and formatting ready to go.

## Features

- Astro 5.13+ with static site generation
- Tailwind CSS 4 with Vite plugin
- TypeScript support
- ESLint and Prettier configuration
- Uses pnpm as package manager

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Package Manager**: [pnpm](https://pnpm.io/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Linting**: [ESLint](https://eslint.org/)
- **Formatting**: [Prettier](https://prettier.io/)
- **Pre-Commit Linting**: [Husky](https://typicode.github.io/husky/) & [lint-staged](https://github.com/lint-staged/lint-staged)

## Project Structure

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
|   |   └── etc.
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── eslint.config.mjs
├── package.json
├── .prettierrc.mjs
├── .prettierignore
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

1. Clone the repository

   ```bash
   git clone <repository-url>
   cd temporary-portfolio
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Start the development server

   ```bash
   pnpm dev
   ```

4. Open your browser and navigate to `http://localhost:4321`

## Available Scripts

| Command        | Description                                   |
| -------------- | --------------------------------------------- |
| `pnpm dev`     | Start development server                      |
| `pnpm build`   | Build for production (includes type checking) |
| `pnpm preview` | Preview production build locally              |
| `pnpm astro`   | Run Astro CLI commands                        |

## Styling

This template uses Tailwind CSS 4 with the Vite plugin:

- Global styles: `src/styles/global.css`
- Tailwind config: Configured via the Vite plugin in `astro.config.mjs`

## Code Quality

### ESLint Configuration

The project uses a flat ESLint configuration with:

- JavaScript/TypeScript: ESLint recommended + TypeScript ESLint
- Astro: Official Astro ESLint plugin
- React: React and JSX a11y rules

### Prettier Configuration

Formatting is handled by Prettier with:

- Astro support: `prettier-plugin-astro`
- Tailwind integration: `prettier-plugin-tailwindcss`
- Configuration: 2 spaces, semicolons, double quotes

### Running Linting & Formatting

```bash
# Run ESLint
pnpm eslint .

# Run Prettier
pnpm prettier --write .
```

## Building for Production

```bash
# Type check and build
pnpm build

# Preview the build
pnpm preview
```

The build process includes:

1. Type checking with `astro check`
2. Static generation with `astro build`
3. Output in the `dist/` directory
