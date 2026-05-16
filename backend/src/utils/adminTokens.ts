import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AdminPermission, AdminRole } from "../models/Admin.js";

export type AdminJwtPayload = {
  adminId: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  tokenVersion: number;
  jti: string;
};

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAdminAccessToken(input: Omit<AdminJwtPayload, "jti">) {
  const jti = crypto.randomUUID();
  const secret = env.JWT_SECRET || env.JWT_ACCESS_SECRET;
  const token = jwt.sign({ ...input, jti }, secret, {
    expiresIn: env.ACCESS_TOKEN_EXPIRE as SignOptions["expiresIn"]
  } satisfies SignOptions);
  return { token, jti };
}

export function signAdminRefreshToken(input: Omit<AdminJwtPayload, "jti">) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...input, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRE as SignOptions["expiresIn"]
  } satisfies SignOptions);
  return { token, jti };
}

export function verifyAdminAccessToken(token: string) {
  const secret = env.JWT_SECRET || env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret) as AdminJwtPayload & { exp: number; iat: number };
}

export function verifyAdminRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AdminJwtPayload & { exp: number; iat: number };
}

export function cookieOptions(maxAgeMs: number, httpOnly = true) {
  return {
    httpOnly,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/"
  };
}
