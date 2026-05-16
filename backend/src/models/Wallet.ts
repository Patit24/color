import { Schema, model, Types } from "mongoose";

const walletSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", unique: true, required: true, index: true },
    depositBalance: { type: Number, default: 0, min: 0 },
    winningBalance: { type: Number, default: 0, min: 0 },
    bonusBalance: { type: Number, default: 0, min: 0 },
    referralBalance: { type: Number, default: 0, min: 0 },
    lockedBalance: { type: Number, default: 0, min: 0 },
    withdrawableBalance: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

export const Wallet = model("Wallet", walletSchema);
