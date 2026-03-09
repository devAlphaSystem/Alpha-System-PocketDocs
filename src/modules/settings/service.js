import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_PATH = join(__dirname, "../../../data/site-settings.json");

const DEFAULTS = Object.freeze({
  heroWord1: "Pocket",
  heroWord2: "Docs",
  heroSubtitle: "Beautiful, self-hosted documentation for your projects.",
});

let cached = null;

/**
 * Loads site settings from disk into the in-memory cache, creating defaults
 * if the file does not exist.
 *
 * @returns {Promise<Object>} The loaded settings object.
 */
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

/**
 * Returns the current cached site settings.
 *
 * @returns {Object} The site settings object.
 */
export function getSettings() {
  return cached || { ...DEFAULTS };
}

/**
 * Merges new data into the site settings, persists to disk, and updates the cache.
 *
 * @param {Object} data - The settings fields to update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated settings object.
 */
export async function updateSettings(data, requestId) {
  const updated = { ...getSettings(), ...data };
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(updated, null, 2));
  cached = updated;
  logger.info("Site settings updated", { requestId });
  return updated;
}
