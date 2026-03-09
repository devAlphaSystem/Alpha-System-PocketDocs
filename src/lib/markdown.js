import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import sanitizeHtml from "sanitize-html";

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

marked.setOptions({
  gfm: true,
  breaks: false,
});

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "h4", "h5", "h6", "details", "summary", "mark", "del", "ins", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "span", "div", "hr", "br", "input"]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    code: ["class"],
    span: ["class"],
    pre: ["class"],
    div: ["class", "id"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    a: ["href", "title", "target", "rel"],
    th: ["align"],
    td: ["align"],
    h1: ["id"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    h5: ["id"],
    h6: ["id"],
    input: ["type", "checked", "disabled"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: "noopener noreferrer",
        ...(attribs.href && !attribs.href.startsWith("#") && !attribs.href.startsWith("/") ? { target: "_blank" } : {}),
      },
    }),
  },
};

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withUniqueSlug(base, seen) {
  const root = base || "section";
  const count = seen.get(root) || 0;
  seen.set(root, count + 1);
  return count === 0 ? root : `${root}-${count + 1}`;
}

function addHeadingIds(html) {
  const seen = new Map();

  const reserveId = (candidate) => {
    const key = candidate || "section";
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    return count === 0 ? key : `${key}-${count + 1}`;
  };

  return html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
    const idMatch = attrs.match(/\sid=["']([^"']+)["']/i);
    if (idMatch) {
      const reservedId = reserveId(idMatch[1]);
      if (reservedId === idMatch[1]) {
        return full;
      }
      return `<h${level}${attrs.replace(/\sid=["'][^"']+["']/i, ` id="${reservedId}"`)}>${inner}</h${level}>`;
    }

    const plainText = inner.replace(/<[^>]+>/g, " ").trim();
    const id = withUniqueSlug(slugifyHeading(plainText), seen);
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
}

/**
 * Renders a Markdown string to sanitized HTML with syntax-highlighted code
 * blocks and unique heading IDs.
 *
 * @param {string} content - The raw Markdown source text.
 * @returns {string} Sanitized HTML string.
 */
export function renderMarkdown(content) {
  if (!content) {
    return "";
  }
  const raw = marked.parse(content);
  const sanitized = sanitizeHtml(raw, sanitizeOptions);
  return addHeadingIds(sanitized);
}

/**
 * Extracts a flat list of h2–h4 headings from an HTML string for use in
 * table-of-contents generation.
 *
 * @param {string} html - The HTML string to extract headings from.
 * @returns {Array<{ level: number, id: string, text: string }>} Ordered array of heading objects.
 */
export function extractHeadings(html) {
  const headingRegex = /<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const headings = [];
  const seen = new Map();
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const attrs = match[2] || "";
    const text = match[3].replace(/<[^>]+>/g, "").trim();
    const attrId = attrs.match(/\sid=["']([^"']+)["']/i)?.[1] || "";
    const id = attrId ? withUniqueSlug(attrId, seen) : withUniqueSlug(slugifyHeading(text), seen);
    headings.push({ level, id, text });
  }

  return headings;
}
