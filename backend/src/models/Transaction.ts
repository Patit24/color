import { Schema, model, Types } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    walletId: { type: Types.ObjectId, ref: "Wallet", required: true },
    type: {
      type: String,
      enum: [
        "DEPOSIT_REQUEST",
        "DEPOSIT_APPROVED",
        "WITHDRAWAL_REQUEST",
        "WITHDRAWAL_APPROVED",
        "WITHDRAWAL_REJECTED",
        "BET_PLACED",
        "BET_REFUNDED",
        "BET_WON",
        "BET_LOST",
        "CRASH_BET",
        "CRASH_WIN",
        "SLOT_BET",
        "SLOT_WIN",
        "BONUS_CREDITED",
        "REFERRAL_CREDITED",
        "ADMIN_ADJUSTMENT"
      ],
      required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED", "REVERSED"], default: "PENDING" },
    referenceId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const Transaction = model("Transaction", transactionSchema);
