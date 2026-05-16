import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectMongo() {
  if (env.MONGO_URI === "memory") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri(), {
      autoIndex: true
    });
    console.log("Using in-memory MongoDB for local development");
    return;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI, {
    autoIndex: env.NODE_ENV !== "production"
  });
}
