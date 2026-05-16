import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Admin, type AdminPermission, type AdminRole } from "../models/Admin.js";
import { TokenBlacklist } from "../models/TokenBlacklist.js";
import { verifyAdminAccessToken, type AdminJwtPayload } from "../utils/adminTokens.js";

declare global {
  // Express augments Request through a namespace in its own type model.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export async function verifyAdminToken(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_access_token;
  if (!token) return unauthorized(res);

  try {
    const payload = verifyAdminAccessToken(token);
    const blacklisted = await TokenBlacklist.exists({ jti: payload.jti });
    if (blacklisted) return unauthorized(res);

    const admin = await Admin.findById(payload.adminId).select("isActive role permissions refreshTokenVersion");
    if (!admin?.isActive) return unauthorized(res);
    if (admin.refreshTokenVersion !== payload.tokenVersion) return unauthorized(res);

    req.admin = {
      adminId: payload.adminId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      tokenVersion: payload.tokenVersion,
      jti: payload.jti
    };
    next();
  } catch {
    return unauthorized(res);
  }
}

export function verifyRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) return unauthorized(res);
    next();
  };
}

export function verifyPermission(...permissions: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) return unauthorized(res);
    if (req.admin.role === "super_admin") return next();
    const allowed = permissions.every((permission) => req.admin!.permissions.includes(permission));
    if (!allowed) return unauthorized(res);
    next();
  };
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const csrfCookie = req.cookies?.admin_csrf_token;
  const csrfHeader = req.headers["x-csrf-token"];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return unauthorized(res);
  next();
}

export function makeCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function unauthorized(res: Response) {
  return res.status(401).json({ success: false, message: "Unauthorized Access" });
}
