import { z } from "zod";
import { SLUG_PATTERN, MAX_SLUG_LENGTH, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from "../../config/constants.js";

/** @type {import("zod").ZodObject} Validates project creation data including name, slug, visibility, and mode. */
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(MAX_TITLE_LENGTH),
  slug: z.string().trim().min(1, "Slug is required.").max(MAX_SLUG_LENGTH).regex(SLUG_PATTERN, "Slug must contain only lowercase letters, numbers, and hyphens."),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional().default(""),
  visibility: z.enum(["public", "private"]).default("private"),
  mode: z.enum(["versioned", "simple"]).default("versioned"),
});

/** @type {import("zod").ZodObject} Validates partial project update data (mode is excluded from updates). */
export const updateProjectSchema = createProjectSchema.omit({ mode: true }).partial();
