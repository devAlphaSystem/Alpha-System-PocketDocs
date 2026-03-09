import { z } from "zod";

/** @type {import("zod").ZodObject} Validates site hero and subtitle settings. */
export const updateSettingsSchema = z.object({
  heroWord1: z.string().trim().min(1, "Hero word 1 is required.").max(50),
  heroWord2: z.string().trim().min(1, "Hero word 2 is required.").max(50),
  heroSubtitle: z.string().trim().max(300).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates IP restriction toggle and allow-list data. */
export const updateIpRestrictionSchema = z.object({
  enabled: z.enum(["enable", "disable"]),
  allowedIps: z.string().trim().max(5000).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates combined site settings and IP restriction data. */
export const updateAllSettingsSchema = updateSettingsSchema.merge(updateIpRestrictionSchema);
