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
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_EXPIRE: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRE: z.string().default("7d"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  CRYPTO_DEPOSIT_WALLET: z.string().optional(),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000")
});

let parsedEnv;
try {
  parsedEnv = schema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error("\n❌ ENVIRONMENT VALIDATION FAILED! Please check your Render/Railway environment variables:");
    err.issues.forEach((issue) => {
      console.error(`   👉 [${issue.path.join(".")}] - ${issue.message}`);
    });
    console.error("\nPlease add these missing variables in your hosting provider's dashboard and redeploy!\n");
    process.exit(1);
  }
  throw err;
}

export const env = parsedEnv;
