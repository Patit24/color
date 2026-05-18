import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type TokenUser } from "../utils/tokens.js";
import { User } from "../models/User.js";

declare global {
  // Express augments Request through a namespace in its own type model.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenUser;
      deviceFingerprint?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.user_access_token;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select("isActive status role");
    if (!user) {
      return res.status(401).json({ success: false, message: "User session is invalid. Please log in again." });
    }
    if (!user.isActive || user.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }
    req.auth = payload;
    req.deviceFingerprint = String(req.headers["x-device-fingerprint"] || "unknown");
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
