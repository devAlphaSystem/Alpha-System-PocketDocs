import { z } from "zod";

export const updateSettingsSchema = z.object({
  heroWord1: z.string().trim().min(1, "Hero word 1 is required.").max(50),
  heroWord2: z.string().trim().min(1, "Hero word 2 is required.").max(50),
  heroSubtitle: z.string().trim().max(300).optional().default(""),
});

export const updateIpRestrictionSchema = z.object({
  enabled: z.enum(["enable", "disable"]),
  allowedIps: z.string().trim().max(5000).optional().default(""),
});

export const updateAllSettingsSchema = updateSettingsSchema.merge(updateIpRestrictionSchema);
