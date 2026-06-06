import { z } from "zod";
import { SLUG_PATTERN, MAX_SLUG_LENGTH, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH, KNOWLEDGE_BASE_SECTIONS } from "../../config/constants.js";
import { importMarkdownPagesSchema } from "../pages/validation.js";

const sectionSchema = z.enum([KNOWLEDGE_BASE_SECTIONS.FAQ, KNOWLEDGE_BASE_SECTIONS.TROUBLESHOOTING]);

/** @type {import("zod").ZodObject} Validates Knowledge Base page creation data. */
export const createKnowledgeBasePageSchema = z.object({
  section: sectionSchema,
  title: z.string().trim().min(1, "Article title is required.").max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1, "Slug is required.").max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN, "Slug must contain only lowercase letters, numbers, and hyphens."),
  content: z.string().max(MAX_CONTENT_LENGTH).default(""),
  parent: z.string().max(15).optional().default(""),
  icon: z.string().max(50).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates partial Knowledge Base page update data. */
export const updateKnowledgeBasePageSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  slug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  parent: z.string().max(15).optional(),
  icon: z.string().max(50).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

/** @type {import("zod").ZodObject} Validates Knowledge Base page reorder data. */
export const reorderKnowledgeBasePagesSchema = z.object({
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

/** @type {import("zod").ZodObject} Validates bulk Markdown Knowledge Base import payloads. */
export const importKnowledgeBaseMarkdownPagesSchema = importMarkdownPagesSchema;
