import { z } from "zod";
import { MAX_LABEL_LENGTH } from "../../config/constants.js";

export const createVersionSchema = z.object({
  label: z.string().trim().min(1, "Version label is required.").max(MAX_LABEL_LENGTH),
  is_public: z.preprocess((v) => v === "true" || v === true || v === "on", z.boolean()).default(false),
  clone_from: z.string().max(15).optional().default(""),
});

export const updateVersionSchema = z.object({
  label: z.string().trim().min(1, "Version label is required.").max(MAX_LABEL_LENGTH).optional(),
  is_public: z.preprocess((v) => v === "true" || v === true || v === "on", z.boolean()).optional(),
  order: z.coerce.number().int().min(0).optional(),
});
