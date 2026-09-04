import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

// Security & Config Imports
import validateEnv from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { NotFoundError } from "./utils/errors.js";
import { helmet, apiLimiter, authLimiter } from "./middleware/security.js";

// Route Imports
import authRoutes from "./routes/auth.js";
import clubRoutes from "./routes/clubs.js";
import eventRoutes from "./routes/events.js";
import memberRoutes from "./routes/members.js";
import registrationRoutes from "./routes/registrations.js";
import uploadRoutes from "./routes/uploads.js";
import { getAuthSecret } from "./utils/auth.js";

const app = express();

/**
 * Trust Proxy
 * Required when running behind a reverse proxy (like Render, Heroku, or Nginx)
 * to ensure the rate limiter identifies the correct client IP.
 */
app.set("trust proxy", 1);

// 1. Apply Helmet for secure HTTP headers (XSS protection, Clickjacking, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"] },
    },
  }),
);

// 2. Configure CORS
const allowedOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL;
const corsOrigins = allowedOrigin.split(",").map((origin) => origin.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));

// 3. Body Parser with limit
app.use(express.json({ limit: "5mb" }));

// 4. Apply Rate Limiters
// Global API limiter
app.use("/api/", apiLimiter);

// Specific limiters for sensitive routes (login & registration endpoints)
app.use("/api/clubs/login", authLimiter);
app.use("/api/clubs/platform/login", authLimiter);
app.use("/api/clubs/register", authLimiter);
app.use("/api/members/login", authLimiter);

// 5. Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/uploads", uploadRoutes);

// Base Routes
app.get("/", (_req, res) => res.send("Zephyr PR tracker API running"));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 404 Handler for unmapped API routes
app.use("/api/*", (_req, _res, next) => {
  next(new NotFoundError("Requested API endpoint not found"));
});

// Centralized Safe Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

export async function connectDB() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI environment variable");
  }
  await mongoose.connect(process.env.MONGO_URI);
  return mongoose.connection;
}

export const connectToDatabase = connectDB;
export { app };
export default app;

const isMainModule = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isMainModule) {
  try {
    validateEnv();
  } catch (err) {
    process.exit(1);
  }

  connectDB()
    .then(() => {
      getAuthSecret();
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("Mongo connection error:", err.message);
      process.exit(1);
    });
}
