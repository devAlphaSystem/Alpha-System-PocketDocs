import { z } from "zod";
import { SLUG_PATTERN, MAX_SLUG_LENGTH, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH, MARKDOWN_IMPORT, PAGE_SECTIONS } from "../../config/constants.js";

const sectionSchema = z.enum([PAGE_SECTIONS.DOCUMENTS, PAGE_SECTIONS.FAQ, PAGE_SECTIONS.TROUBLESHOOTING]);

/** @type {import("zod").ZodObject} Validates page creation data including title, slug, and content. */
export const createPageSchema = z.object({
  section: sectionSchema.default(PAGE_SECTIONS.DOCUMENTS),
  title: z.string().trim().min(1, "Page title is required.").max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1, "Slug is required.").max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN, "Slug must contain only lowercase letters, numbers, and hyphens."),
  content: z.string().max(MAX_CONTENT_LENGTH).default(""),
  parent: z.string().max(15).optional().default(""),
  icon: z.string().max(50).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates partial page update data. */
export const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  slug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  parent: z.string().max(15).optional(),
  icon: z.string().max(50).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

/** @type {import("zod").ZodObject} Validates a batch page reorder request. */
export const reorderPagesSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(15),
        order: z.number().int().min(0),
        parent: z.string().max(15).default(""),
      }),
    )
    .min(1),
});

/** @type {import("zod").ZodObject} Validates bulk Markdown page import payloads. */
export const importMarkdownPagesSchema = z
  .object({
    files: z
      .array(
        z.object({
          filename: z.string().trim().min(1, "Markdown filename is required.").max(500, "Markdown filename is too long."),
          content: z.string().max(MAX_CONTENT_LENGTH, "Markdown file content is too large."),
        }),
      )
      .min(1, "Select at least one Markdown file to import."),
  })
  .superRefine((data, ctx) => {
    const totalLength = data.files.reduce((sum, file) => sum + file.content.length, 0);
    if (totalLength > MARKDOWN_IMPORT.MAX_TOTAL_CONTENT_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["files"],
        message: `Markdown import content is larger than ${MARKDOWN_IMPORT.MAX_TOTAL_CONTENT_LENGTH} characters.`,
      });
    }
  });
