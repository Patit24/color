import bcrypt from "bcryptjs";
import { Router } from "express";
import { Admin, type AdminPermission, type AdminRole } from "../../models/Admin.js";
import { TokenBlacklist } from "../../models/TokenBlacklist.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { makeCsrfToken, verifyAdminToken } from "../../middleware/adminAuth.js";
import {
  cookieOptions,
  hashToken,
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken
} from "../../utils/adminTokens.js";

export const adminAuthRouter = Router();

const accessCookieAge = 15 * 60 * 1000;
const refreshCookieAge = 7 * 24 * 60 * 60 * 1000;

function adminPayload(admin: {
  _id: unknown;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  refreshTokenVersion: number;
}) {
  return {
    adminId: String(admin._id),
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
    tokenVersion: admin.refreshTokenVersion
  };
}

function setAdminCookies(res: import("express").Response, input: { accessToken: string; refreshToken: string }) {
  const csrfToken = makeCsrfToken();
  res.cookie("admin_access_token", input.accessToken, cookieOptions(accessCookieAge));
  res.cookie("admin_refresh_token", input.refreshToken, cookieOptions(refreshCookieAge));
  res.cookie("admin_csrf_token", csrfToken, cookieOptions(refreshCookieAge, false));
  return csrfToken;
}

function clearAdminCookies(res: import("express").Response) {
  res.clearCookie("admin_access_token", { path: "/" });
  res.clearCookie("admin_refresh_token", { path: "/" });
  res.clearCookie("admin_csrf_token", { path: "/" });
}

adminAuthRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body.adminId || req.body.identifier || req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const deviceFingerprint = String(req.headers["x-device-fingerprint"] || "unknown");
    const admin = await Admin.findOne({
      $or: [{ adminId: identifier }, { email: identifier }]
    }).select("+password +refreshTokenHash");

    if (!admin) {
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    if (admin.lockUntil && admin.lockUntil > new Date()) {
      return res.status(429).json({ success: false, message: "Unauthorized Access" });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword || !admin.isActive) {
      admin.failedLoginCount += 1;
      if (admin.failedLoginCount >= 5) {
        admin.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      admin.loginHistory.push({
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        deviceFingerprint,
        success: false,
        reason: "Invalid credentials"
      });
      await admin.save();
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    admin.failedLoginCount = 0;
    admin.lockUntil = undefined;
    admin.lastLogin = new Date();
    admin.refreshTokenVersion += 1;
    const payload = adminPayload(admin);
    const access = signAdminAccessToken(payload);
    const refresh = signAdminRefreshToken(payload);
    admin.refreshTokenHash = hashToken(refresh.token);
    admin.loginHistory.push({
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      deviceFingerprint,
      success: true
    });
    await admin.save();

    const csrfToken = setAdminCookies(res, { accessToken: access.token, refreshToken: refresh.token });
    res.json({
      success: true,
      csrfToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        passwordChangeRequired: admin.passwordChangeRequired
      }
    });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.admin_refresh_token;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    const payload = verifyAdminRefreshToken(refreshToken);
    const blacklisted = await TokenBlacklist.exists({ jti: payload.jti });
    if (blacklisted) return res.status(401).json({ success: false, message: "Unauthorized Access" });

    const admin = await Admin.findById(payload.adminId).select("+refreshTokenHash");
    if (!admin?.isActive || admin.refreshTokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    if (admin.refreshTokenHash !== hashToken(refreshToken)) {
      admin.refreshTokenVersion += 1;
      admin.refreshTokenHash = undefined;
      await admin.save();
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    await TokenBlacklist.create({
      jti: payload.jti,
      adminId: admin._id,
      expiresAt: new Date(payload.exp * 1000),
      reason: "refresh rotation"
    });

    admin.refreshTokenVersion += 1;
    const nextPayload = adminPayload(admin);
    const access = signAdminAccessToken(nextPayload);
    const refresh = signAdminRefreshToken(nextPayload);
    admin.refreshTokenHash = hashToken(refresh.token);
    await admin.save();
    const csrfToken = setAdminCookies(res, { accessToken: access.token, refreshToken: refresh.token });
    res.json({ success: true, csrfToken });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.post("/logout", async (req, res, next) => {
  try {
    const accessToken = req.cookies?.admin_access_token;
    const refreshToken = req.cookies?.admin_refresh_token;
    if (accessToken) {
      try {
        const payload = verifyAdminAccessToken(accessToken);
        await TokenBlacklist.create({
          jti: payload.jti,
          adminId: payload.adminId,
          expiresAt: new Date(payload.exp * 1000),
          reason: "logout"
        });
      } catch {
        // Token may already be expired; clearing cookies is enough.
      }
    }
    if (refreshToken) {
      try {
        const payload = verifyAdminRefreshToken(refreshToken);
        await TokenBlacklist.create({
          jti: payload.jti,
          adminId: payload.adminId,
          expiresAt: new Date(payload.exp * 1000),
          reason: "logout"
        });
        await Admin.findByIdAndUpdate(payload.adminId, { $inc: { refreshTokenVersion: 1 }, $unset: { refreshTokenHash: "" } });
      } catch {
        // Token may already be expired; clearing cookies is enough.
      }
    }
    clearAdminCookies(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.get("/me", verifyAdminToken, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin!.adminId).select("name email role permissions lastLogin loginHistory isActive");
    if (!admin) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    res.json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.post("/change-password", verifyAdminToken, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const nextPassword = String(req.body.nextPassword || "");
    if (nextPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }
    const admin = await Admin.findById(req.admin!.adminId).select("+password");
    if (!admin) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    admin.password = await bcrypt.hash(nextPassword, 12);
    admin.passwordChangeRequired = false;
    admin.refreshTokenVersion += 1;
    admin.refreshTokenHash = undefined;
    await admin.save();
    clearAdminCookies(res);
    res.json({ success: true, message: "Password changed. Please login again." });
  } catch (error) {
    next(error);
  }
});
