import mongoose from "mongoose";
import { env } from "./env";

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = global as typeof globalThis & { __mongoose?: Cached };
const cached: Cached = globalWithMongoose.__mongoose ?? { conn: null, promise: null };
globalWithMongoose.__mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    cached.promise = mongoose
      .connect(env.MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 })
      .then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
