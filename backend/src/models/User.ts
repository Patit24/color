import { Schema, model, Types } from "mongoose";

export type UserRole = "real_user" | "demo_user";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "FROZEN";

const deviceSchema = new Schema(
  {
    fingerprint: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    userId: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    fullName: { type: String, trim: true },
    name: { type: String, trim: true },
    mobile: { type: String, unique: true, sparse: true, index: true },
    phone: { type: String, unique: true, sparse: true, index: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, index: true },
    firebaseUid: { type: String, unique: true, sparse: true, index: true },
    passwordHash: { type: String, select: false },
    telegramId: { type: String, unique: true, sparse: true, index: true },
    telegramUsername: { type: String, index: true },
    telegramPhotoUrl: { type: String },
    telegramChatId: { type: String },
    referralCode: { type: String, unique: true, required: true, index: true },
    referredBy: { type: Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["real_user", "demo_user"], default: "real_user" },
    accountType: { type: String, enum: ["REAL", "DEMO"], default: "REAL", index: true },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED", "BANNED", "FROZEN"], default: "ACTIVE" },
    isActive: { type: Boolean, default: true, index: true },
    kycStatus: { type: String, enum: ["PENDING", "VERIFIED", "REJECTED"], default: "PENDING" },
    vipLevel: { type: Number, default: 0 },
    refreshTokenHash: { type: String, select: false },
    refreshTokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date },
    devices: [deviceSchema],
    loginHistory: [deviceSchema],
    passwordChangeRequired: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    bankruptcyRecoveryTriggered: { type: Boolean, default: false },
    newUserRewardTriggered: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
