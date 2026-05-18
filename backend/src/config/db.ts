import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectMongo() {
  if (env.MONGO_URI === "memory") {
    const { MongoMemoryReplSet } = await import("mongodb-memory-server");
    const replSet = await MongoMemoryReplSet.create({
      replSet: {
        storageEngine: "wiredTiger",
      },
    });
    await mongoose.connect(replSet.getUri(), {
      autoIndex: true
    });
    console.log("Using in-memory MongoDB Replica Set for local development (transactions supported)");
    return;
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGO_URI, {
    autoIndex: env.NODE_ENV !== "production"
  });
}
