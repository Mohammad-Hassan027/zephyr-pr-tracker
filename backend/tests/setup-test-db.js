import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer = null;

export async function setupTestDb() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
      return mongoose.connection;
    } catch (err) {
      console.warn("External MONGO_URI connection failed, starting in-memory MongoDB fallback:", err.message);
    }
  }

  // Spin up disposable MongoMemoryServer
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function teardownTestDb() {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

export default { setupTestDb, teardownTestDb };
