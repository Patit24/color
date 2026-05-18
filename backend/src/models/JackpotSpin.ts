import { Schema, model, Types } from "mongoose";

const jackpotSpinSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    betAmount: { type: Number, required: true, min: 2 },
    reels: [[{ type: String }]], // 3 reels x 3 rows
    paylines: [
      {
        lineIndex: { type: Number },
        symbols: [{ type: String }],
        payout: { type: Number }
      }
    ],
    totalWin: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    jackpotType: { type: String, enum: ["NONE", "MINI", "MAJOR", "MEGA"], default: "NONE" },
    jackpotWin: { type: Number, default: 0 },
    bonusTriggered: { type: Boolean, default: false },
    bonusPicks: [
      {
        chestIndex: { type: Number },
        reward: { type: Number }
      }
    ],
    bonusTotal: { type: Number, default: 0 },
    multiplier: { type: Number, default: 0 },
    seedHash: { type: String },
    deviceFingerprint: { type: String },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

export const JackpotSpin = model("JackpotSpin", jackpotSpinSchema);
