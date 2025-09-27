# Deutz & Krüger Portfoli

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
