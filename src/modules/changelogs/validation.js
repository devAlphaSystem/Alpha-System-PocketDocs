import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "../../config/constants.js";

/** @type {import("zod").ZodObject} Validates changelog creation data. */
export const createChangelogSchema = z.object({
  content: z.string().min(1, "Changelog content is required.").max(MAX_CONTENT_LENGTH),
  published_at: z.string().optional().default(""),
});

/** @type {import("zod").ZodObject} Validates changelog update data with optional fields. */
export const updateChangelogSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  published_at: z.string().optional(),
});
