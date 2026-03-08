import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "../../config/constants.js";

export const createChangelogSchema = z.object({
  content: z.string().min(1, "Changelog content is required.").max(MAX_CONTENT_LENGTH),
  published_at: z.string().optional().default(""),
});

export const updateChangelogSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  published_at: z.string().optional(),
});
