import rateLimit from "express-rate-limit";
import helmet from "helmet";

/**
 * Global API Limiter
 * Limits overall traffic to the API to prevent general abuse.
 * Allows 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Authentication Limiter
 * Strict limits for login and signup to prevent brute-force and credential stuffing.
 * Allows 10 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many login or signup attempts. Please try again after 15 minutes.",
  },
});

/**
 * Registration Limiter
 * Limits the number of new registrations to prevent spam and server overload.
 * Allows 5 submissions per 10 minutes per IP.
 */
export const registrationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Too many registration attempts. Please wait 10 minutes before trying again.",
  },
});

export { helmet };
