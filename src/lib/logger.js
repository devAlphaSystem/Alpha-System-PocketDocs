/**
 * @module logger
 * @description Configures and exports a Winston logger with console transport
 * and automatic sensitive-value masking.
 */
import winston from "winston";
import { env } from "../config/env.js";
import { maskObject, maskSensitiveValue } from "./masking.js";

const { combine, timestamp, colorize, printf, errors } = winston.format;

const SAFE_INFO_KEYS = new Set(["level", "message", "timestamp", "service", "stack"]);

const maskFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (SAFE_INFO_KEYS.has(key)) continue;
    const val = info[key];
    if (val && typeof val === "object") {
      info[key] = maskObject(val);
    } else {
      info[key] = maskSensitiveValue(key, val);
    }
  }
  return info;
});

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss.SSS" }),
  errors({ stack: true }),
  maskFormat(),
  printf(({ timestamp: ts, level, message, requestId, service, ...rest }) => {
    const reqPart = requestId ? ` [${requestId}]` : "";
    const svcPart = service ? ` (${service})` : "";
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    return `${ts} ${level}${svcPart}${reqPart}: ${message}${extra}`;
  }),
);

/**
 * Application-wide Winston logger instance with console transport.
 *
 * @type {import("winston").Logger}
 */
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "pocketdocs" },
  transports: [new winston.transports.Console({ format: consoleFormat })],
  exitOnError: false,
});

export { logger };
