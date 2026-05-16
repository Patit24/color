import { Schema, model } from "mongoose";

const tokenBlacklistSchema = new Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    reason: { type: String }
  },
  { timestamps: true }
);

export const TokenBlacklist = model("TokenBlacklist", tokenBlacklistSchema);
