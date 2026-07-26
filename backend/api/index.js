import serverless from "serverless-http";
import app, { connectDB } from "../server.js";

let handler = null;

export default async function (req, res) {
  if (!handler) {
    // ensure DB is connected before handling requests
    try {
      await connectDB();
    } catch (err) {
      console.error("DB connect failed:", err);
      res.statusCode = 500;
      res.end("Database connection failed");
      return;
    }
    handler = serverless(app);
  }
  return handler(req, res);
}
