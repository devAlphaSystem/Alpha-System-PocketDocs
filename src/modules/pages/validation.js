import { z } from "zod";
import { SLUG_PATTERN, MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../../config/constants.js";

export const createPageSchema = z.object({
  title: z.string().trim().min(1, "Page title is required.").max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1, "Slug is required.").max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN, "Slug must contain only lowercase letters, numbers, and hyphens."),
  content: z.string().default(""),
  parent: z.string().max(15).optional().default(""),
  icon: z.string().max(50).optional().default(""),
});

export const updatePageSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  slug: z.string().trim().min(1).max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN).optional(),
  content: z.string().optional(),
  parent: z.string().max(15).optional(),
  icon: z.string().max(50).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

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
