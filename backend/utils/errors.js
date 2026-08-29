/**
 * Standard Application Error Classes
 * Maps business and validation errors to appropriate HTTP status codes and stable public error codes.
 */

export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code="INTERNAL_SERVER_ERROR"] - Stable public error code
   * @param {any} [details=null] - Optional error details
   */
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details = null) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details = null) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", details = null) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested resource not found", details = null) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource state conflict", details = null) {
    super(message, 409, "CONFLICT_ERROR", details);
  }
}

export class ProviderError extends AppError {
  constructor(message = "External service provider error", details = null) {
    super(message, 502, "PROVIDER_ERROR", details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database service unavailable", statusCode = 503, details = null) {
    super(message, statusCode, "SERVICE_UNAVAILABLE", details);
  }
}
