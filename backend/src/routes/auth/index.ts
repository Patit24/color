import bcrypt from "bcryptjs";
import { Router } from "express";
import { customAlphabet } from "nanoid";
import { User } from "../../models/User.js";
import { Wallet } from "../../models/Wallet.js";
import { TokenBlacklist } from "../../models/TokenBlacklist.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/auth.js";
import { makeCsrfToken } from "../../middleware/adminAuth.js";
import { cookieOptions, hashToken } from "../../utils/adminTokens.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../utils/tokens.js";

const referralCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
export const authRouter = Router();

const accessCookieAge = 15 * 60 * 1000;
const refreshCookieAge = 7 * 24 * 60 * 60 * 1000;

function setUserCookies(res: import("express").Response, accessToken: string, refreshToken: string) {
  const csrfToken = makeCsrfToken();
  res.cookie("user_access_token", accessToken, cookieOptions(accessCookieAge));
  res.cookie("user_refresh_token", refreshToken, cookieOptions(refreshCookieAge));
  res.cookie("user_csrf_token", csrfToken, cookieOptions(refreshCookieAge, false));
  return csrfToken;
}

function clearUserCookies(res: import("express").Response) {
  res.clearCookie("user_access_token", { path: "/" });
  res.clearCookie("user_refresh_token", { path: "/" });
  res.clearCookie("user_csrf_token", { path: "/" });
}

authRouter.post("/register", (_req, res) => {
  res.status(403).json({
    success: false,
    message: "Public registration is disabled. Users are created by admin panel or Telegram connection."
  });
});

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || req.body.userId || req.body.mobile || req.body.phone || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const deviceFingerprint = String(req.headers["x-device-fingerprint"] || "unknown");
    const user = await User.findOne({
      $or: [{ userId: identifier }, { mobile: identifier }, { phone: identifier }]
    }).select("+passwordHash +refreshTokenHash");
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({ success: false, message: "Unauthorized Access" });
    }

    const validPassword = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!validPassword || !user.isActive || user.status !== "ACTIVE") {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= 5) user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.devices.push({
        fingerprint: deviceFingerprint,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown"
      });
      await user.save();
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    user.failedLoginCount = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    user.refreshTokenVersion += 1;
    user.devices.push({
      fingerprint: deviceFingerprint,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown"
    });
    const accessToken = signAccessToken(user._id, user.role);
    const refreshToken = signRefreshToken(user._id, user.role);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();
    const csrfToken = setUserCookies(res, accessToken, refreshToken);
    res.json({
      success: true,
      csrfToken,
      user: {
        id: user._id,
        userId: user.userId,
        fullName: user.fullName || user.name,
        mobile: user.mobile || user.phone,
        role: user.role,
        accountType: user.accountType,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.user_refresh_token;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    const payload = verifyRefreshToken(refreshToken);
    const blacklisted = await TokenBlacklist.exists({ jti: `${payload.userId}:${payload.iat}` });
    if (blacklisted) return res.status(401).json({ success: false, message: "Unauthorized Access" });
    const user = await User.findById(payload.userId).select("+refreshTokenHash");
    if (!user?.isActive || user.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    await TokenBlacklist.create({
      jti: `${payload.userId}:${payload.iat}`,
      expiresAt: new Date(payload.exp * 1000),
      reason: "user refresh rotation"
    });
    user.refreshTokenVersion += 1;
    const nextAccess = signAccessToken(user._id, user.role);
    const nextRefresh = signRefreshToken(user._id, user.role);
    user.refreshTokenHash = hashToken(nextRefresh);
    await user.save();
    const csrfToken = setUserCookies(res, nextAccess, nextRefresh);
    res.json({ success: true, csrfToken });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const accessToken = req.cookies?.user_access_token;
    if (accessToken) {
      try {
        const payload = verifyAccessToken(accessToken);
        await User.findByIdAndUpdate(payload.userId, { $inc: { refreshTokenVersion: 1 }, $unset: { refreshTokenHash: "" } });
      } catch {
        // Expired access token still gets cookies cleared.
      }
    }
    clearUserCookies(res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId).select("userId fullName mobile telegramUsername referralCode role accountType status");
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/telegram/webhook", async (req, res, next) => {
  try {
    const telegramId = String(req.body.telegramId || req.body.message?.from?.id || "");
    if (!telegramId) return res.status(400).json({ success: false, message: "telegramId required" });
    const telegramUsername = String(req.body.telegramUsername || req.body.message?.from?.username || "");
    const chatId = String(req.body.chatId || req.body.message?.chat?.id || telegramId);
    const user = await User.findOneAndUpdate(
      { telegramId },
      {
        $setOnInsert: {
          userId: `tg${telegramId}`,
          fullName: telegramUsername || `Telegram ${telegramId}`,
          name: telegramUsername || `Telegram ${telegramId}`,
          referralCode: referralCode(),
          role: "real_user",
          accountType: "REAL"
        },
        telegramId,
        telegramUsername,
        telegramChatId: chatId,
        telegramPhotoUrl: req.body.profilePhoto || ""
      },
      { upsert: true, new: true }
    );
    await Wallet.findOneAndUpdate({ userId: user._id }, { $setOnInsert: { userId: user._id } }, { upsert: true });
    res.json({ success: true, userId: user.userId });
  } catch (error) {
    next(error);
  }
});
