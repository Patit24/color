import { Schema, model, Types } from "mongoose";

const slotSpinSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    betAmount: { type: Number, required: true, min: 10 },
    reels: [[{ type: String }]], // 5 reels x 3 rows
    paylines: [
      {
        lineIndex: { type: Number },
        symbols: [{ type: String }],
        payout: { type: Number }
      }
    ],
    totalWin: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    isJackpot: { type: Boolean, default: false },
    multiplier: { type: Number, default: 0 },
    seedHash: { type: String },
    deviceFingerprint: { type: String },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

export const SlotSpin = model("SlotSpin", slotSpinSchema);
