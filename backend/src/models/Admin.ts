import { Schema, model } from "mongoose";

export type AdminRole = "super_admin" | "finance_admin" | "support_admin" | "game_manager";
export type AdminPermission =
  | "manage_users"
  | "manage_games"
  | "manage_payments"
  | "manage_wallets"
  | "view_analytics"
  | "manage_bonuses"
  | "send_notifications"
  | "view_fraud";

const loginHistorySchema = new Schema(
  {
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    deviceFingerprint: { type: String, required: true },
    success: { type: Boolean, required: true },
    reason: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    adminId: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin", "finance_admin", "support_admin", "game_manager"],
      required: true,
      index: true
    },
    permissions: [
      {
        type: String,
        enum: [
          "manage_users",
          "manage_games",
          "manage_payments",
          "manage_wallets",
          "view_analytics",
          "manage_bonuses",
          "send_notifications",
          "view_fraud"
        ]
      }
    ],
    refreshTokenHash: { type: String, select: false },
    refreshTokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLogin: { type: Date },
    loginHistory: [loginHistorySchema],
    passwordChangeRequired: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

export const Admin = model("Admin", adminSchema);
