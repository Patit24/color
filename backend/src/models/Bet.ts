import { Schema, model, Types } from "mongoose";

const betSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Types.ObjectId, ref: "Round", required: true, index: true },
    period: { type: String, required: true, index: true },
    targetType: { type: String, enum: ["COLOR", "NUMBER", "SIZE"], required: true },
    targetValue: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    odds: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "WON", "LOST", "REFUNDED"], default: "PENDING" },
    payout: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    deviceFingerprint: { type: String },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

betSchema.index({ userId: 1, roundId: 1, targetValue: 1 });

export const Bet = model("Bet", betSchema);
