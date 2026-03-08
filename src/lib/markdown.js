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

export function renderMarkdown(content) {
  if (!content) {
    return "";
  }
  const raw = marked.parse(content);
  return sanitizeHtml(raw, sanitizeOptions);
}

export function extractHeadings(html) {
  const headingRegex = /<h([2-4])\s*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[2-4]>/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const id =
      match[2] ||
      match[3]
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const text = match[3].replace(/<[^>]+>/g, "");
    headings.push({ level, id, text });
  }

  return headings;
}
