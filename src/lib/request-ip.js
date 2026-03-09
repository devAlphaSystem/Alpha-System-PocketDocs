function getHeaderValue(headers, name) {
  const value = headers?.[name];

  if (Array.isArray(value)) {
    return value.join(",");
  }

  return typeof value === "string" ? value : "";
}

function splitForwardedHeader(value) {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter(Boolean);
}

/**
 * Normalizes an IP address by stripping ports, converting IPv6-mapped IPv4,
 * and resolving loopback addresses.
 *
 * @param {string} ip - The raw IP address string.
 * @returns {string} The normalized IP address, or an empty string if invalid.
 */
export function normalizeIp(ip) {
  const raw = String(ip || "").trim();

  if (!raw) {
    return "";
  }

  if (raw === "::1") {
    return "127.0.0.1";
  }

  if (raw.startsWith("::ffff:")) {
    return normalizeIp(raw.slice(7));
  }

  const bracketedIpv6Match = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6Match) {
    return normalizeIp(bracketedIpv6Match[1]);
  }

  const ipv4WithPortMatch = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  if (ipv4WithPortMatch) {
    return ipv4WithPortMatch[1];
  }

  return raw;
}

/**
 * Extracts and normalizes the client IP address from an Express request.
 *
 * @param {import("express").Request} req - The Express request object.
 * @returns {string} The normalized client IP address.
 */
export function getClientIp(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress || "");
}

/**
 * Returns a detailed breakdown of all IP-related data for debugging proxy
 * and forwarding configurations.
 *
 * @param {import("express").Request} req - The Express request object.
 * @returns {{ clientIp: string, proxyIps: Array<string>, remoteAddress: string, xForwardedFor: Array<string>, xRealIp: string }} IP debug information.
 */
export function getClientIpDebug(req) {
  return {
    clientIp: getClientIp(req),
    proxyIps: Array.isArray(req.ips) ? req.ips.map((ip) => normalizeIp(ip)).filter(Boolean) : [],
    remoteAddress: normalizeIp(req.socket?.remoteAddress || ""),
    xForwardedFor: splitForwardedHeader(getHeaderValue(req.headers, "x-forwarded-for")),
    xRealIp: normalizeIp(getHeaderValue(req.headers, "x-real-ip")),
  };
}
