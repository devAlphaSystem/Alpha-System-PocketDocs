import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { env } from "../config/env.js";
import { maskObject } from "./masking.js";

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const maskFormat = winston.format((info) => {
  if (info.metadata && typeof info.metadata === "object") {
    info.metadata = maskObject(info.metadata);
  }
  return info;
});

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss.SSS" }),
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
