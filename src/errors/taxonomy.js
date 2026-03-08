import { AppError } from "./app-error.js";

export class ValidationError extends AppError {
  constructor(message = "One or more fields are invalid.", details = []) {
    super(message, {
      code: "VALIDATION_FAILED",
      statusCode: 422,
      isOperational: true,
      details,
    });
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required.") {
    super(message, {
      code: "UNAUTHORIZED",
      statusCode: 401,
      isOperational: true,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, {
      code: "FORBIDDEN",
      statusCode: 403,
      isOperational: true,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found.`, {
      code: "RESOURCE_NOT_FOUND",
      statusCode: 404,
      isOperational: true,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "A conflict occurred with the current state.") {
    super(message, {
      code: "CONFLICT",
      statusCode: 409,
      isOperational: true,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, {
      code: "RATE_LIMITED",
      statusCode: 429,
      isOperational: true,
    });
  }
}

export class DomainError extends AppError {
  constructor(message, code = "DOMAIN_ERROR") {
    super(message, {
      code,
      statusCode: 422,
      isOperational: true,
    });
  }
}

export class InfrastructureError extends AppError {
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

export class ExternalServiceError extends AppError {
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

export class InternalError extends AppError {
  constructor(message = "An internal error occurred.", { cause = null } = {}) {
    super(message, {
      code: "INTERNAL_ERROR",
      statusCode: 500,
      isOperational: false,
      cause,
    });
  }
}

export class CsrfError extends AppError {
  constructor() {
    super("Invalid or missing CSRF token.", {
      code: "CSRF_INVALID",
      statusCode: 403,
      isOperational: true,
    });
  }
}
