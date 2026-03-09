import { AppError } from "./app-error.js";

/**
 * Represents a validation failure with optional field-level error details.
 *
 * @class
 * @extends AppError
 */
export class ValidationError extends AppError {
  /**
   * Creates a new ValidationError instance.
   *
   * @param {string} [message="One or more fields are invalid."] - Error description.
   * @param {Array<Object>} [details=[]] - Per-field validation failure details.
   */
  constructor(message = "One or more fields are invalid.", details = []) {
    super(message, {
      code: "VALIDATION_FAILED",
      statusCode: 422,
      isOperational: true,
      details,
    });
  }
}

/**
 * Represents a failed authentication attempt (HTTP 401).
 *
 * @class
 * @extends AppError
 */
export class AuthenticationError extends AppError {
  /**
   * Creates a new AuthenticationError instance.
   *
   * @param {string} [message="Authentication required."] - Error description.
   */
  constructor(message = "Authentication required.") {
    super(message, {
      code: "UNAUTHORIZED",
      statusCode: 401,
      isOperational: true,
    });
  }
}

/**
 * Represents an authorization failure where the user lacks permission (HTTP 403).
 *
 * @class
 * @extends AppError
 */
export class AuthorizationError extends AppError {
  /**
   * Creates a new AuthorizationError instance.
   *
   * @param {string} [message="You do not have permission to perform this action."] - Error description.
   */
  constructor(message = "You do not have permission to perform this action.") {
    super(message, {
      code: "FORBIDDEN",
      statusCode: 403,
      isOperational: true,
    });
  }
}

/**
 * Represents a resource that could not be found (HTTP 404).
 *
 * @class
 * @extends AppError
 */
export class NotFoundError extends AppError {
  /**
   * Creates a new NotFoundError instance.
   *
   * @param {string} [resource="Resource"] - The type of resource that was not found.
   */
  constructor(resource = "Resource") {
    super(`${resource} not found.`, {
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
      isOperational: true,
    });
  }
}

/**
 * Represents a conflict with the current state of a resource (HTTP 409).
 *
 * @class
 * @extends AppError
 */
export class ConflictError extends AppError {
  /**
   * Creates a new ConflictError instance.
   *
   * @param {string} [message="A conflict occurred with the current state."] - Error description.
   */
  constructor(message = "A conflict occurred with the current state.") {
    super(message, {
      code: "CONFLICT",
      statusCode: 409,
      isOperational: true,
    });
  }
}

/**
 * Represents a rate-limiting rejection (HTTP 429).
 *
 * @class
 * @extends AppError
 */
export class RateLimitError extends AppError {
  /**
   * Creates a new RateLimitError instance.
   *
   * @param {string} [message="Too many requests. Please try again later."] - Error description.
   */
  constructor(message = "Too many requests. Please try again later.") {
    super(message, {
      code: "RATE_LIMITED",
      statusCode: 429,
      isOperational: true,
    });
  }
}

/**
 * Represents a domain-level business logic error (HTTP 422).
 *
 * @class
 * @extends AppError
 */
export class DomainError extends AppError {
  /**
   * Creates a new DomainError instance.
   *
   * @param {string} message - Error description.
   * @param {string} [code="DOMAIN_ERROR"] - Machine-readable error code.
   */
  constructor(message, code = "DOMAIN_ERROR") {
    super(message, {
      code,
      statusCode: 422,
      isOperational: true,
    });
  }
}

/**
 * Represents a failure in internal infrastructure such as database or file system (HTTP 500).
 *
 * @class
 * @extends AppError
 */
export class InfrastructureError extends AppError {
  /**
   * Creates a new InfrastructureError instance.
   *
   * @param {string} message - Error description.
   * @param {Object} [options] - Additional error metadata.
   * @param {Error|null} [options.cause=null] - The underlying cause.
   */
  constructor(message, { cause = null, ...extra } = {}) {
    super(message, {
      code: "INFRASTRUCTURE_ERROR",
      statusCode: 500,
      isOperational: true,
      cause,
    });
    Object.assign(this, extra);
  }
}

/**
 * Represents a failure when communicating with an external service (HTTP 502).
 *
 * @class
 * @extends AppError
 */
export class ExternalServiceError extends AppError {
  /**
   * Creates a new ExternalServiceError instance.
   *
   * @param {string} message - Error description.
   * @param {Object} [options] - Additional error metadata.
   * @param {Error|null} [options.cause=null] - The underlying cause.
   */
  constructor(message, { cause = null, ...extra } = {}) {
    super(message, {
      code: "EXTERNAL_SERVICE_ERROR",
      statusCode: 502,
      isOperational: true,
      cause,
    });
    Object.assign(this, extra);
  }
}

/**
 * Represents an unexpected internal error that is not operationally recoverable (HTTP 500).
 *
 * @class
 * @extends AppError
 */
export class InternalError extends AppError {
  /**
   * Creates a new InternalError instance.
   *
   * @param {string} [message="An internal error occurred."] - Error description.
   * @param {Object} [options] - Additional error metadata.
   * @param {Error|null} [options.cause=null] - The underlying cause.
   */
  constructor(message = "An internal error occurred.", { cause = null } = {}) {
    super(message, {
      code: "INTERNAL_ERROR",
      statusCode: 500,
      isOperational: false,
      cause,
    });
  }
}

/**
 * Represents a CSRF token validation failure (HTTP 403).
 *
 * @class
 * @extends AppError
 */
export class CsrfError extends AppError {
  /**
   * Creates a new CsrfError instance.
   */
  constructor() {
    super("Invalid or missing CSRF token.", {
      code: "CSRF_INVALID",
      statusCode: 403,
      isOperational: true,
    });
  }
}
