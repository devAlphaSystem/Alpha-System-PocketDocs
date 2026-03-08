export class AppError extends Error {
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
