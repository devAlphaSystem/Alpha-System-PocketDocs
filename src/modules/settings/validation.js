import { z } from "zod";
import { parseSiteIconDataUrl } from "./site-icon.js";

function isValidSiteIcon(value) {
  if (!value) {
    return true;
  }

  return Boolean(parseSiteIconDataUrl(value));
}

/** @type {import("zod").ZodObject} Validates site hero and subtitle settings. */
export const updateSettingsSchema = z.object({
  heroTitle: z.string().trim().min(1, "Hero title is required.").max(200),
  heroSubtitle: z.string().trim().max(300).optional().default(""),
  siteIcon: z.string().max(350000).refine(isValidSiteIcon, "Icon must be a safe SVG, PNG, JPEG, or WebP image up to 256 KB.").optional().default(""),
  removeSiteIcon: z.enum(["true", "false"]).optional().default("false"),
});

/** @type {import("zod").ZodObject} Validates IP restriction toggle and allow-list data. */
const updateIpRestrictionSchema = z.object({
  enabled: z.enum(["enable", "disable"]),
  allowedIps: z.string().trim().max(5000).optional().default(""),
});

/** @type {import("zod").ZodObject} Validates combined site settings and IP restriction data. */
export const updateAllSettingsSchema = updateSettingsSchema.merge(updateIpRestrictionSchema);
