import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

import authRoutes from "./routes/auth.js";
import clubRoutes from "./routes/clubs.js";
import eventRoutes from "./routes/events.js";
import memberRoutes from "./routes/members.js";
import registrationRoutes from "./routes/registrations.js";

const app = express();
app.set("trust proxy", 1);
const allowedOrigin =
  process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "*";
const corsOrigins = allowedOrigin.split(",").map((origin) => origin.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/registrations", registrationRoutes);

app.get("/", (_req, res) => res.send("Zephyr PR tracker API running"));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use((err, _req, res, _next) => {
  if (err) {
    return res.status(400).json({ error: err.message || "Request failed" });
  }
  return res.status(404).json({ error: "Not found" });
});

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
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error("Mongo connection error:", err);
      process.exit(1);
    });
}
