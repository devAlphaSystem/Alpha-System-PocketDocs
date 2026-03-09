import { AppError } from "./app-error.js";
import { logger } from "../lib/logger.js";

export function buildErrorEnvelope(err, requestId) {
  if (err instanceof AppError) {
    const envelope = err.toJSON();
    envelope.error.requestId = requestId;
    return { statusCode: err.statusCode, body: envelope };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
        requestId,
      },
    },
  };
}

export function logError(err, requestId, url) {
  const meta = {
    requestId,
    ...(url && { url }),
    errorCode: err.code || "UNKNOWN",
    errorName: err.name || "Error",
    isOperational: err.isOperational ?? false,
    stack: err.stack,
  };

  if (err.cause) {
    meta.causeMessage = err.cause.message;
    meta.causeStack = err.cause.stack;
  }

  if (err.isOperational === false || !err.isOperational) {
    logger.error(err.message, meta);
  } else if (err.statusCode >= 500) {
    logger.error(err.message, meta);
  } else if (err.statusCode >= 400) {
    logger.warn(err.message, meta);
  } else {
    logger.info(err.message, meta);
  }
}
