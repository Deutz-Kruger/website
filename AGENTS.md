# Agent Guidelines

## Build / Lint / Test Commands

```bash
# Development
pnpm dev                        # Start Astro dev server (localhost:4321)

# Building
pnpm build                      # Build for production
pnpm preview                     # Build and preview with Wrangler

# Linting & Formatting
pnpm lint                        # Run ESLint on .js, .ts, .astro files
pnpm lint:fix                    # Auto-fix ESLint issues
pnpm format                      # Format files with Prettier
pnpm format:check                # Check formatting without changes
pnpm type-check                  # Run Astro type checking

# All Checks (run before committing)
pnpm check                       # Run lint, format check, and type-check

# Utilities
pnpm reset:cache                 # Clear .astro, .cache, .wrangler, dist folders
pnpm sync-media                  # Sync media files to Cloudflare
pnpm admin                       # Run admin dashboard server
```

No test framework is currently configured in this project.

---

## Code Style Guidelines

### Imports

- Use path aliases defined in tsconfig.json:
  - `@/*` → `src/*`
  - `@components/*` → `src/components/*`
  - `@content/*` → `src/content/*`
  - `@layouts/*` → `src/layouts/*`
  - `@styles/*` → `src/styles/*`
- Imports are automatically sorted by `simple-import-sort/imports` ESLint rule
- Group imports: external libs first, then internal dependencies, then relative imports

### Formatting (Prettier)

- Semi-colons: `true`
- Trailing commas: `all`
- Print width: `80` characters
- Tab width: `2` spaces
- Astro files use `astro` parser
- JSONC files use `none` for trailing commas
- Tailwind classes are sorted automatically

### TypeScript

- Strict mode enabled (extends `astro/tsconfigs/strict`)
- Path aliases configured via `baseUrl: "./"`
- `verbatimModuleSyntax: true` - use explicit type-only imports with `import type`
- `noUnusedLocals: false` - unused locals allowed
- JSX: `react-jsx` with import source `react`
- Skip lib checks for faster builds

### Naming Conventions

- **Components**: PascalCase (e.g., `BackgroundGradient`, `NavBar`)
- **Functions/Variables**: camelCase (e.g., `generateKeywords`, `initHeaderLogic`)
- **Constants**: UPPER_SNAKE_CASE for exported config (e.g., `CLOUDFLARE_ACCOUNT`)
- **Types/Interfaces**: PascalCase (e.g., `Props`, `LayoutData`, `Manifest`)
- **Schemas**: lowercase camelCase for zod schemas (e.g., `textBlock`, `blocksUnion`)

### Error Handling

- Use try/catch blocks for async operations
- Log errors with `console.error()` or `console.warn()`
- Type guard unknown errors (e.g., `isErrorWithCode(error)`)
- Return early or throw meaningful errors with context
- Example pattern:
  ```typescript
  try {
    const data = await readFile(path, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      console.log("⚠️ File not found");
    } else {
      console.error(
        "❗ Error:",
        error instanceof Error ? error.message : error,
      );
    }
    return {};
  }
  ```

### Astro Components

- Frontmatter with `---` delimiters
- Use `Astro.props` to access props, destructure immediately
- Type props with `interface Props { }` or infer from zod schemas
- Use `set:html` for trusted HTML content
- Use `class` (not `className`) for HTML elements
- Props passed as attributes, not as `{...props}` unless necessary

### React Components

- Use `className` for class names
- Combine Tailwind classes with `cn()` utility (uses clsx + tailwind-merge)
- Use `interface Props extends React.PropsWithChildren` for components with children
- Export named components: `export const Component = (props: Props) => { ... }`
- Use `useRef` for DOM refs, `useState` for state, `useEffect` for side effects
- Cleanup event listeners and observers in useEffect cleanup functions

### Utility Functions

- Add JSDoc comments for exported functions
- Use TypeScript generics with proper constraints
- Example:
  ```typescript
  export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number,
  ): (this: ThisParameterType, ...args: Parameters) => void {
    // implementation
  }
  ```

### Schemas (Zod)

- Define schemas in `src/content/schemas/`
- Use discriminated unions with `z.discriminatedUnion()` for block types
- Use `z.literal()` for string literals
- Export both schemas and inferred types: `export type TextBlock = z.infer<typeof textBlock>;`

### ESLint Rules

- `simple-import-sort/imports`: Auto-sorts imports (error level)
- `simple-import-sort/exports`: Auto-sorts exports (error level)
- `prettier/prettier`: Disabled (Prettier runs separately)
- No unused eslint disable/enable comments allowed
- `@typescript-eslint/no-explicit-any`: Off in `.astro` files

### Pre-Commit Hooks

- Husky runs on pre-commit
- Lint-staged enforces:
  - Type check on all `.ts`, `.tsx`, `.astro` files
  - ESLint fix on `.ts`, `.tsx`, `.js`, `.jsx`, `.astro` files
  - Prettier format on code, markdown, JSON, YAML, CSS files
