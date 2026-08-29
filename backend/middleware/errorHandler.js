import { AppError } from "../utils/errors.js";

/**
 * Redacts sensitive fields from object before logging
 */
export function sanitizeForLogging(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sensitiveKeys = ["password", "passwordhash", "pin", "token", "auth_secret", "secret", "authorization", "cookie"];
  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Centralized Express Error Handling Middleware
 */
export function errorHandler(err, req, res, _next) {
  const isProduction = process.env.NODE_ENV === "production";

  // Default response values
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || "INTERNAL_SERVER_ERROR";
  let message = err.message || "An internal server error occurred";
  let details = err.details || null;

  // 1. JSON parsing syntax error
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    statusCode = 400;
    errorCode = "INVALID_JSON";
    message = "Invalid JSON payload";
  }
  // 2. Mongoose Validation Error
  else if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.keys(err.errors).reduce((acc, field) => {
      acc[field] = err.errors[field].message;
      return acc;
    }, {});
  }
  // 3. Mongoose CastError (invalid ObjectId format)
  else if (err.name === "CastError") {
    statusCode = 400;
    errorCode = "INVALID_ID";
    message = `Invalid ID format for field '${err.path}'`;
  }
  // 4. MongoDB Duplicate Key Error (Code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = "DUPLICATE_KEY_ERROR";
    const keys = err.keyValue ? Object.keys(err.keyValue).join(", ") : "field";
    message = `Duplicate record conflict on ${keys}`;
  }
  // 5. MongoDB Network or Connection Errors
  else if (
    err.name === "MongoNetworkError" ||
    err.name === "MongoServerSelectionError" ||
    err.name === "MongoTimeoutError"
  ) {
    statusCode = 503;
    errorCode = "SERVICE_UNAVAILABLE";
    message = "Service unavailable";
  }
  // 6. Custom Typed AppError
  else if (err instanceof AppError || err.isOperational) {
    statusCode = err.statusCode || 500;
    errorCode = err.code || (statusCode === 400 ? "BAD_REQUEST" : "APP_ERROR");
    message = err.message;
  }
  // 7. Generic Unexpected Internal Error
  else {
    statusCode = 500;
    errorCode = "INTERNAL_SERVER_ERROR";
    if (isProduction) {
      message = "An internal server error occurred";
    }
  }

  // Log error silently without exposing sensitive credentials or stack trace in production response
  if (statusCode >= 500 && !process.env.SUPPRESS_ERROR_LOGS) {
    console.error(`[Error ${statusCode} - ${errorCode}]:`, {
      message: err.message,
      url: req.originalUrl || req.url,
      method: req.method,
      stack: isProduction ? undefined : err.stack,
    });
  }

  const responsePayload = {
    error: message,
    code: errorCode,
  };

  if (details && Object.keys(details).length > 0) {
    responsePayload.details = details;
  }

  return res.status(statusCode).json(responsePayload);
}

export default errorHandler;
