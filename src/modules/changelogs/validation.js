import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "../../config/constants.js";

/** @type {import("zod").ZodObject} Validates changelog update data with optional fields. */
export const updateChangelogSchema = z.object({
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
});
