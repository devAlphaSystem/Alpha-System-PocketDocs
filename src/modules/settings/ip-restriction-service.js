import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/logger.js";
import { normalizeIp } from "../../lib/request-ip.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IP_RESTRICTION_PATH = join(__dirname, "../../../data/ip-restriction.json");

const DEFAULTS = Object.freeze({
  enabled: "disable",
  allowedIps: "127.0.0.1",
});

let cached = null;

function parseAllowedIps(value) {
  return String(value || "")
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeAllowedIps(value) {
  return parseAllowedIps(value).join("\n");
}

export async function loadIpRestriction() {
  try {
    const raw = await readFile(IP_RESTRICTION_PATH, "utf-8");
    cached = {
      ...DEFAULTS,
      ...JSON.parse(raw),
    };
    cached.allowedIps = normalizeAllowedIps(cached.allowedIps);
  } catch (err) {
    if (err.code === "ENOENT") {
      await mkdir(dirname(IP_RESTRICTION_PATH), { recursive: true });
      await writeFile(IP_RESTRICTION_PATH, JSON.stringify(DEFAULTS, null, 2));
      cached = { ...DEFAULTS };
      logger.info("Created default IP restriction settings");
    } else {
      logger.error("Failed to load IP restriction settings", { error: err.message });
      cached = { ...DEFAULTS };
    }
  }
  return cached;
}

export function getIpRestriction() {
  return cached || { ...DEFAULTS };
}

export async function updateIpRestriction(data, requestId, currentIp) {
  let ips = normalizeAllowedIps(data.allowedIps ?? getIpRestriction().allowedIps);

  if (data.enabled === "enable" && currentIp) {
    const ipList = parseAllowedIps(ips);
    const normalizedCurrent = normalizeIp(currentIp);
    const alreadyIncluded = ipList.some((entry) => normalizeIp(entry) === normalizedCurrent);
    if (!alreadyIncluded && normalizedCurrent) {
      ips = ips ? `${normalizedCurrent}\n${ips}` : normalizedCurrent;
      logger.info("Auto-included current IP in allowed list to prevent lockout", { requestId, ip: normalizedCurrent });
    }
  }

  const updated = {
    ...getIpRestriction(),
    ...data,
    allowedIps: ips,
  };
  await mkdir(dirname(IP_RESTRICTION_PATH), { recursive: true });
  await writeFile(IP_RESTRICTION_PATH, JSON.stringify(updated, null, 2));
  cached = updated;
  logger.info("IP restriction settings updated", { requestId });
  return updated;
}

export function isIpAllowed(ip) {
  const config = getIpRestriction();
  if (config.enabled !== "enable") return true;
  if (!config.allowedIps || !config.allowedIps.trim()) return true;

  const allowedList = parseAllowedIps(config.allowedIps);

  if (allowedList.length === 0) return true;

  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp) return false;

  return allowedList.some((allowed) => {
    const normalizedAllowed = normalizeIp(allowed);
    return normalizedIp === normalizedAllowed;
  });
}
