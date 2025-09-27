/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  bracketSpacing: true,
  semi: true,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  tailwindConfig: "/src/styles/global.css",
  overrides: [
    {
      files: ["**/*.astro"],
      options: {
        parser: "astro",
      },
    },
  ],
};
