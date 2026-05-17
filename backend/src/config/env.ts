import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../.env" });
dotenv.config();

if (process.env.PORT === "") {
  delete process.env.PORT;
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_EXPIRE: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRE: z.string().default("7d"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  CRYPTO_DEPOSIT_WALLET: z.string().optional(),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000")
});

export const env = schema.parse(process.env);
