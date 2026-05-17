import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { corsOriginResolver } from "./config/cors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { adminRouter } from "./routes/admin/index.js";
import { adminAuthRouter } from "./routes/adminAuth/index.js";
import { authRouter } from "./routes/auth/index.js";
import { gameRouter } from "./routes/game/index.js";
import { walletRouter } from "./routes/wallet/index.js";
import { referralRouter } from "./routes/referral/index.js";
import { crashRouter } from "./routes/crash/index.js";
import { slotsRouter } from "./routes/slots/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: corsOriginResolver, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(apiLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/admin-auth", adminAuthRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/game", gameRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/referrals", referralRouter);
  app.use("/api/crash", crashRouter);
  app.use("/api/slots", slotsRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
