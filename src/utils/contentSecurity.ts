import { Marked, Renderer } from "marked";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

const isSafeLink = (href: string): boolean => {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
};

const renderer = new Renderer();

renderer.html = () => "";
renderer.image = ({ text }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  if (!isSafeLink(href)) return text;

  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(href)}"${titleAttribute}>${text}</a>`;
};

const safeMarkdown = new Marked({
  async: false,
  renderer,
});

/** Converts repository-authored Markdown into HTML without allowing raw HTML or unsafe links. */
export const renderSafeMarkdown = (markdown: string): string =>
  safeMarkdown.parse(markdown) as string;

/** Serializes JSON-LD without allowing a value to terminate its script element. */
export const serializeJsonLd = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, "\\u003c");
