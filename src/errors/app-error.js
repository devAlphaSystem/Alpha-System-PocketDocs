/**
 * Base application error class providing structured error metadata for
 * operational and programmer errors throughout the application.
 *
 * @class
 * @extends Error
 */
export class AppError extends Error {
  /**
   * Creates a new AppError instance.
   *
   * @param {string} message - Human-readable error description.
   * @param {Object} [options] - Error metadata options.
   * @param {string} [options.code] - Machine-readable error code.
   * @param {number} [options.statusCode] - HTTP status code to respond with.
   * @param {boolean} [options.isOperational=true] - Whether the error is expected and recoverable.
   * @param {Array|null} [options.details=null] - Additional validation or field-level error details.
   * @param {Error|null} [options.cause=null] - The underlying error that caused this one.
   */
  constructor(message, { code, statusCode, isOperational = true, details = null, cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (cause) {
      this.cause = cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serializes the error to a JSON-safe envelope suitable for HTTP responses.
   *
   * @returns {Object} An object containing the `error` envelope with code, message, and optional details.
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.isOperational ? this.message : "An unexpected error occurred. Please try again later.",
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
