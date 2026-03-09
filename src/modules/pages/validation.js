import { z } from "zod";
import { SLUG_PATTERN, MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../../config/constants.js";

/** @type {import("zod").ZodObject} Validates page creation data including title, slug, and content. */
export const createPageSchema = z.object({
  title: z.string().trim().min(1, "Page title is required.").max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1, "Slug is required.").max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN, "Slug must contain only lowercase letters, numbers, and hyphens."),
  content: z.string().default(""),
  parent: z.string().max(15).optional().default(""),
  icon: z.string().max(50).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates partial page update data. */
export const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  slug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN).optional(),
  content: z.string().optional(),
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
