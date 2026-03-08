import { z } from "zod";

export const updateSettingsSchema = z.object({
  headerBrand: z.string().trim().min(1, "Header brand is required.").max(100),
  heroWord1: z.string().trim().min(1, "Hero word 1 is required.").max(50),
  heroWord2: z.string().trim().min(1, "Hero word 2 is required.").max(50),
  heroSubtitle: z.string().trim().max(300).optional().default(""),
});
