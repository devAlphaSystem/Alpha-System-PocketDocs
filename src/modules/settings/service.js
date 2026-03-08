import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_PATH = join(__dirname, "../../../data/site-settings.json");

const DEFAULTS = Object.freeze({
  headerBrand: "PocketDocs",
  heroWord1: "Pocket",
  heroWord2: "Docs",
  heroSubtitle: "Beautiful, self-hosted documentation for your projects.",
});

let cached = null;

export async function loadSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    cached = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    if (err.code === "ENOENT") {
      await mkdir(dirname(SETTINGS_PATH), { recursive: true });
      await writeFile(SETTINGS_PATH, JSON.stringify(DEFAULTS, null, 2));
      cached = { ...DEFAULTS };
      logger.info("Created default site settings");
    } else {
      logger.error("Failed to load site settings", { error: err.message });
      cached = { ...DEFAULTS };
    }
  }
  return cached;
}

export function getSettings() {
  return cached || { ...DEFAULTS };
}

export async function updateSettings(data) {
  const updated = { ...getSettings(), ...data };
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(updated, null, 2));
  cached = updated;
  logger.info("Site settings updated");
  return updated;
}
