/**
 * @module logger
 * @description Configures and exports a Winston logger with daily-rotating file
 * transports, automatic sensitive-value masking, and structured JSON output.
 */
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { env } from "../config/env.js";
import { maskObject, maskSensitiveValue } from "./masking.js";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

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
  maskFormat(),
  printf(({ timestamp: ts, level, message, requestId, service, ...rest }) => {
    const reqPart = requestId ? ` [${requestId}]` : "";
    const svcPart = service ? ` (${service})` : "";
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    return `${ts} ${level}${svcPart}${reqPart}: ${message}${extra}`;
  }),
);

const fileFormat = combine(timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }), errors({ stack: true }), maskFormat(), json());

const transports = [];

if (env.NODE_ENV === "development") {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

transports.push(
  new DailyRotateFile({
    dirname: env.LOG_DIR,
    filename: "pocketdocs-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    format: fileFormat,
    level: env.LOG_LEVEL,
  }),
);

transports.push(
  new DailyRotateFile({
    dirname: env.LOG_DIR,
    filename: "pocketdocs-error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "14d",
    format: fileFormat,
    level: "error",
  }),
);

/**
 * Application-wide Winston logger instance with console and file transports.
 *
 * @type {import("winston").Logger}
 */
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "pocketdocs" },
  transports,
  exitOnError: false,
  exceptionHandlers: [
    new DailyRotateFile({
      dirname: env.LOG_DIR,
      filename: "pocketdocs-exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      dirname: env.LOG_DIR,
      filename: "pocketdocs-rejections-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: fileFormat,
    }),
  ],
});

export { logger };
