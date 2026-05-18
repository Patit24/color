import { Schema, model, Types } from "mongoose";

const crashBetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    roundId: { type: Types.ObjectId, ref: "CrashRound", required: true, index: true },
    roundNumber: { type: Number, required: true, index: true },
    amount: { type: Number, required: true, min: 2 },
    autoCashout: { type: Number, default: 0 }, // 0 = manual
    cashedOutAt: { type: Number, default: 0 }, // multiplier at cashout
    payout: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "CASHED_OUT", "BUSTED"],
      default: "ACTIVE"
    },
    deviceFingerprint: { type: String },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

crashBetSchema.index({ userId: 1, roundId: 1 }, { unique: true });

export const CrashBet = model("CrashBet", crashBetSchema);
