import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type TokenUser = {
  userId: string;
  role: string;
};

export function signAccessToken(userId: Types.ObjectId | string, role: string) {
  return jwt.sign({ userId: String(userId), role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRE as SignOptions["expiresIn"]
  } satisfies SignOptions);
}

export function signRefreshToken(userId: Types.ObjectId | string, role: string) {
  return jwt.sign({ userId: String(userId), role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRE as SignOptions["expiresIn"]
  } satisfies SignOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenUser & { exp: number; iat: number };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenUser & { exp: number; iat: number };
}
