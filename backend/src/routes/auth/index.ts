import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { User } from "../../models/User.js";
import { Wallet } from "../../models/Wallet.js";
import { Admin } from "../../models/Admin.js";
import { customAlphabet } from "nanoid";
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

authRouter.get("/setup-admin", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash("Admin@12345", 12);
    const adminUser = await Admin.findOneAndUpdate(
      { adminId: "superadmin" },
      {
        name: "Super Admin",
        adminId: "superadmin",
        email: "superadmin@colortrade.app",
        password: hashedPassword,
        role: "super_admin",
        permissions: ["manage_users", "manage_games", "manage_payments", "manage_wallets"],
        isActive: true
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "Admin created/updated successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const identifier = String(req.body.identifier || req.body.userId || req.body.mobile || req.body.phone || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const deviceFingerprint = String(req.headers["x-device-fingerprint"] || "unknown");

    // 1. Check Player Collection
    let user = await User.findOne({
      $or: [{ userId: identifier }, { mobile: identifier }, { phone: identifier }, { email: identifier }]
    }).select("+passwordHash +refreshTokenHash");

    // 2. If not found, Check Admin Collection
    if (!user) {
      console.log(`[Login] Checking admin collection for: ${identifier}`);
      const adminUser = await Admin.findOne({
        $or: [
          { adminId: identifier }, 
          { email: identifier }
        ]
      }).select("+password");

      if (adminUser) {
        console.log(`[Login] Found admin: ${adminUser.adminId}, verifying password...`);
        const validAdminPassword = await bcrypt.compare(password, adminUser.password);
        if (validAdminPassword && adminUser.isActive) {
          console.log(`[Login] Admin authenticated: ${adminUser.adminId}`);
          const accessToken = signAccessToken(adminUser._id, adminUser.role);
          const refreshToken = signRefreshToken(adminUser._id, adminUser.role);
          const csrfToken = setUserCookies(res, accessToken, refreshToken);
          
          return res.json({
            success: true,
            csrfToken,
            user: {
              id: adminUser._id,
              userId: adminUser.adminId,
              fullName: adminUser.name,
              role: adminUser.role,
              isAdmin: true
            }
          });
        } else {
          console.log(`[Login] Password mismatch or inactive for admin: ${adminUser.adminId}`);
        }
      }
      return res.status(401).json({ success: false, message: "Unauthorized Access" });
    }

    // 3. Process Player Login
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({ success: false, message: "Unauthorized Access" });
    }

    const validPassword = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    const userStatus = user.status || "ACTIVE";
    if (!validPassword || user.isActive === false || userStatus !== "ACTIVE") {
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

authRouter.post("/firebase-sync", async (req, res, next) => {
  try {
    const { idToken, password, identifier } = req.body;
    if (!idToken || !password) {
      return res.status(400).json({ success: false, message: "idToken and password are required" });
    }

    const decoded = jwt.decode(idToken) as any;
    if (!decoded) {
      return res.status(400).json({ success: false, message: "Invalid ID token format" });
    }

    // Verify Project ID (color-trade-4a76f)
    const projectId = "color-trade-4a76f";
    if (decoded.aud !== projectId || (decoded.iss && !decoded.iss.includes(projectId))) {
      return res.status(401).json({ success: false, message: "Unauthorized token source" });
    }

    // Parse identifier from email
    const email = decoded.email || "";
    const userId = email.split("@")[0] || identifier || decoded.sub;
    const phone = decoded.phone_number ? decoded.phone_number.replace("+91", "").replace("+", "") : "";

    // Check if the user already exists in MongoDB
    let user = await User.findOne({
      $or: [{ userId }, { mobile: phone }, { phone }]
    }).select("+passwordHash +refreshTokenHash");

    const firebaseUid = decoded.uid || decoded.sub;

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 12);
      user = await User.create({
        userId,
        firebaseUid,
        fullName: decoded.name || userId,
        name: decoded.name || userId,
        mobile: phone || userId,
        phone: phone || userId,
        referralCode: referralCode(),
        passwordHash: hashedPassword,
        role: "real_user",
        accountType: "REAL",
        status: "ACTIVE",
        isActive: true
      });

      const wallet = await Wallet.create({
        userId: user._id,
        depositBalance: 0,
        withdrawableBalance: 0
      });
    } else if (!user.firebaseUid) {
      user.firebaseUid = firebaseUid;
      await user.save();
    }

    // Standard local login flow
    user.lastLoginAt = new Date();
    user.refreshTokenVersion += 1;
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
