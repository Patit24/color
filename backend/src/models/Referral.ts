import { Schema, model, Types } from "mongoose";

const referralSchema = new Schema(
  {
    inviterId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    invitedUserId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    level: { type: Number, default: 1 },
    commissionRate: { type: Number, default: 0.02 },
    totalCommission: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" }
  },
  { timestamps: true }
);

export const Referral = model("Referral", referralSchema);
