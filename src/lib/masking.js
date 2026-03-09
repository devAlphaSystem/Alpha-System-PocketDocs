const EMAIL_PATTERN = /^[^@]+@[^@]+$/;
const PHONE_PATTERN = /\d{4,}/;
const TOKEN_PATTERN = /^(sk-|pk-|key-|tok-|bearer\s+)/i;
const CARD_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}\b/;
const SESSION_PATTERN = /^sess[-_]/i;

function maskEmail(email) {
  if (!email || typeof email !== "string") {
    return "[REDACTED]";
  }
  const parts = email.split("@");
  if (parts.length !== 2) {
    return "[REDACTED]";
  }
  const local = parts[0];
  const domain = parts[1];
  const visibleLocal = local.length > 1 ? local[0] + "***" : "***";
  return `${visibleLocal}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== "string") {
    return "[REDACTED]";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return "[REDACTED]";
  }
  return `***-***-${digits.slice(-4)}`;
}

function maskToken(token) {
  if (!token || typeof token !== "string") {
    return "[REDACTED]";
  }
  if (token.length <= 8) {
    return "[REDACTED]";
  }
  const prefix = token.slice(0, 3);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}

function maskCard(card) {
  if (!card || typeof card !== "string") {
    return "[REDACTED]";
  }
  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) {
    return "[REDACTED]";
  }
  return `****-****-****-${digits.slice(-4)}`;
}

function maskSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== "string") {
    return "[REDACTED]";
  }
  if (sessionId.length <= 10) {
    return "[REDACTED]";
  }
  return `sess-...${sessionId.slice(-6)}`;
}

function maskIp(ip) {
  if (!ip || typeof ip !== "string") {
    return "[REDACTED]";
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  const colonParts = ip.split(":");
  if (colonParts.length > 2) {
    return colonParts.slice(0, 4).join(":") + ":***";
  }
  return "[REDACTED]";
}

/**
 * Masks a single value based on its key name using pattern-matched redaction
 * rules for emails, phones, tokens, cards, sessions, IPs, and passwords.
 *
 * @param {string} key - The field or property name.
 * @param {*} value - The value to potentially mask.
 * @returns {*} The original value or a masked replacement string.
 */
export function maskSensitiveValue(key, value) {
  if (value === null || value === undefined) {
    return value;
  }

  const strValue = String(value);
  const lowerKey = typeof key === "string" ? key.toLowerCase() : "";

  if (lowerKey.includes("password") || lowerKey.includes("passwd") || lowerKey.includes("secret")) {
    return "[NEVER_LOGGED]";
  }

  if (lowerKey.includes("email") && EMAIL_PATTERN.test(strValue)) {
    return maskEmail(strValue);
  }

  if (lowerKey.includes("phone") || lowerKey.includes("mobile") || lowerKey.includes("tel")) {
    return maskPhone(strValue);
  }

  if (lowerKey.includes("token") || lowerKey.includes("apikey") || lowerKey.includes("api_key") || lowerKey.includes("authorization")) {
    return maskToken(strValue);
  }

  if (lowerKey.includes("card") || lowerKey.includes("credit") || CARD_PATTERN.test(strValue)) {
    return maskCard(strValue);
  }

  if (lowerKey.includes("session") || SESSION_PATTERN.test(strValue)) {
    return maskSessionId(strValue);
  }

  if (lowerKey.includes("ip") && lowerKey !== "skip" && lowerKey !== "tip") {
    return maskIp(strValue);
  }

  return value;
}

/**
 * Recursively traverses an object and masks sensitive values by key name.
 *
 * @param {Object|Array|*} obj - The object, array, or primitive to mask.
 * @returns {Object|Array|*} A deep copy with sensitive values redacted.
 */
export function maskObject(obj) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskObject(value);
    } else {
      masked[key] = maskSensitiveValue(key, value);
    }
  }
  return masked;
}
