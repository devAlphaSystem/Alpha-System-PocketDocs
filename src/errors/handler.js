import { AppError } from "./app-error.js";
import { logger } from "../lib/logger.js";

/**
 * Builds a structured HTTP error response envelope from an error instance.
 *
 * @param {Error|AppError} err - The error to convert.
 * @param {string} requestId - The unique request identifier for traceability.
 * @returns {{ statusCode: number, body: Object }} The HTTP status code and JSON response body.
 */
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

/**
 * Logs an error with contextual metadata at the appropriate severity level.
 *
 * @param {Error|AppError} err - The error to log.
 * @param {string} requestId - The unique request identifier.
 * @param {string} [url] - The request URL where the error occurred.
 * @returns {void}
 */
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
