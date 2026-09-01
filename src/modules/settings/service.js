import { File } from "node:buffer";
import { logger } from "../../lib/logger.js";
import { pbBatch, pbClient, pbCreate, pbDelete, pbList, pbUpdate } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { ValidationError } from "../../errors/taxonomy.js";
import { isSafeSvg, parseSiteIconDataUrl } from "./site-icon.js";

const DEFAULT_SITE_ICON_URL = "/img/pd-logo.svg";
const SITE_SETTING_KEYS = Object.freeze({
  TITLE: "title",
  SUBTITLE: "subtitle",
  ICON: "icon",
});

const DEFAULTS = Object.freeze({
  heroTitle: "Pocket**Docs**",
  heroSubtitle: "Beautiful, **self-hosted** documentation for your *projects*.",
});

const TEXT_SETTING_DEFINITIONS = Object.freeze([
  { key: SITE_SETTING_KEYS.TITLE, property: "heroTitle", defaultValue: DEFAULTS.heroTitle },
  { key: SITE_SETTING_KEYS.SUBTITLE, property: "heroSubtitle", defaultValue: DEFAULTS.heroSubtitle },
]);

let cached = { ...DEFAULTS };
let cachedRecords = new Map();
let cachedSiteIconAsset = null;

async function ensureSettingRecord(key, value = "") {
  const existing = cachedRecords.get(key);
  if (existing) {
    return existing;
  }

  const result = await pbCreate(COLLECTIONS.SITE_SETTINGS, { key, value });
  if (!result.ok) {
    throw new ValidationError(`Failed to initialize the ${key} site setting.`);
  }

  cachedRecords.set(key, result.data);
  return result.data;
}

async function migratePreviousIconRecord() {
  const previousRecord = cachedRecords.get("default");
  if (!previousRecord) {
    return;
  }

  if (!cachedRecords.has(SITE_SETTING_KEYS.ICON)) {
    const result = await pbUpdate(COLLECTIONS.SITE_SETTINGS, previousRecord.id, { key: SITE_SETTING_KEYS.ICON, value: "" });
    if (!result.ok) {
      throw new ValidationError("Failed to migrate the site icon setting.");
    }
    cachedRecords.delete("default");
    cachedRecords.set(SITE_SETTING_KEYS.ICON, result.data);
    return;
  }

  const result = await pbDelete(COLLECTIONS.SITE_SETTINGS, previousRecord.id);
  if (!result.ok) {
    throw new ValidationError("Failed to remove the obsolete site settings record.");
  }
  cachedRecords.delete("default");
}

/**
 * Loads each PocketBase-backed site setting into the in-memory read cache.
 *
 * @returns {Promise<Object>} The loaded text settings.
 */
export async function loadSettings() {
  const result = await pbList(COLLECTIONS.SITE_SETTINGS, { page: 1, perPage: 20 });
  cachedRecords = new Map((result.items || []).map((record) => [record.key, record]));
  cachedSiteIconAsset = null;

  await migratePreviousIconRecord();

  for (const definition of TEXT_SETTING_DEFINITIONS) {
    await ensureSettingRecord(definition.key, definition.defaultValue);
  }
  await ensureSettingRecord(SITE_SETTING_KEYS.ICON);

  cached = Object.fromEntries(
    TEXT_SETTING_DEFINITIONS.map((definition) => {
      const value = cachedRecords.get(definition.key)?.value;
      const useStoredValue = typeof value === "string" && (definition.property !== "heroTitle" || value.trim() !== "");
      return [definition.property, useStoredValue ? value : definition.defaultValue];
    }),
  );

  return cached;
}

/**
 * Returns the current cached site settings.
 *
 * @returns {Object} The site settings object.
 */
export function getSettings() {
  return { ...cached };
}

/**
 * Updates the title and subtitle records in PocketBase.
 *
 * @param {{ heroTitle: string, heroSubtitle: string }} data - Text settings to update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated settings object.
 */
export async function updateSettings(data, requestId) {
  const operations = TEXT_SETTING_DEFINITIONS.map((definition) => ({
    method: "update",
    collection: COLLECTIONS.SITE_SETTINGS,
    id: cachedRecords.get(definition.key).id,
    data: { value: data[definition.property] },
  }));
  const result = await pbBatch(operations);
  if (!result.ok) {
    throw new ValidationError("Failed to update site settings.");
  }

  cached = {
    heroTitle: data.heroTitle,
    heroSubtitle: data.heroSubtitle,
  };
  logger.info("Site settings updated", { requestId });
  return getSettings();
}

/**
 * Returns whether a custom icon is stored in PocketBase.
 *
 * @returns {boolean}
 */
export function hasCustomSiteIcon() {
  return Boolean(cachedRecords.get(SITE_SETTING_KEYS.ICON)?.icon);
}

/**
 * Returns the same-origin URL used by views for the current site icon.
 *
 * @returns {string}
 */
export function getSiteIconUrl() {
  if (!hasCustomSiteIcon()) {
    return DEFAULT_SITE_ICON_URL;
  }

  const iconRecord = cachedRecords.get(SITE_SETTING_KEYS.ICON);
  const version = iconRecord.updated || iconRecord.icon;
  return `/site-icon?v=${encodeURIComponent(version)}`;
}

function siteIconFileFromDataUrl(dataUrl) {
  const parsed = parseSiteIconDataUrl(dataUrl);
  if (!parsed) {
    throw new ValidationError("The site icon data is invalid.");
  }

  return new File([parsed.bytes], `site-icon.${parsed.extension}`, { type: parsed.mimeType });
}

/**
 * Replaces or removes the custom site icon stored by PocketBase.
 *
 * @param {{ dataUrl?: string, remove?: boolean }} data - Icon update data.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated site settings record.
 */
export async function updateSiteIcon({ dataUrl = "", remove = false }, requestId) {
  if (!dataUrl && !remove) {
    return ensureSettingRecord(SITE_SETTING_KEYS.ICON);
  }

  const record = await ensureSettingRecord(SITE_SETTING_KEYS.ICON);
  const formData = new FormData();

  if (dataUrl) {
    formData.append("icon", siteIconFileFromDataUrl(dataUrl));
  } else {
    formData.append("icon", "");
  }

  const result = await pbUpdate(COLLECTIONS.SITE_SETTINGS, record.id, formData);
  if (!result.ok) {
    throw new ValidationError("Failed to update the site icon.");
  }

  cachedRecords.set(SITE_SETTING_KEYS.ICON, result.data);
  cachedSiteIconAsset = null;
  logger.info("Site icon updated", { requestId, custom: Boolean(result.data.icon) });
  return result.data;
}

/**
 * Fetches the current icon file from PocketBase for same-origin delivery.
 *
 * @returns {Promise<{ data: Buffer, contentType: string }|null>}
 */
export async function getSiteIconAsset() {
  if (!hasCustomSiteIcon()) {
    return null;
  }

  const iconRecord = cachedRecords.get(SITE_SETTING_KEYS.ICON);
  if (cachedSiteIconAsset?.filename === iconRecord.icon) {
    return cachedSiteIconAsset;
  }

  const fileUrl = pbClient().files.getURL(iconRecord, iconRecord.icon);
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to load the site icon from PocketBase: HTTP ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new Error("PocketBase returned an invalid site icon content type.");
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (contentType === "image/svg+xml" && !isSafeSvg(data)) {
    throw new Error("PocketBase returned an unsafe SVG site icon.");
  }

  cachedSiteIconAsset = {
    filename: iconRecord.icon,
    data,
    contentType,
  };
  return cachedSiteIconAsset;
}
