import { Schema, model, Types } from "mongoose";

const paymentRequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["DEPOSIT", "WITHDRAWAL"], required: true, index: true },
    method: { type: String, enum: ["RAZORPAY", "UPI", "BANK", "CRYPTO", "MANUAL"], required: true },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "APPROVED", "REJECTED", "FAILED"],
      default: "PENDING",
      index: true
    },
    providerReference: { type: String, index: true },
    payoutAddress: { type: String },
    reviewedBy: { type: Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const PaymentRequest = model("PaymentRequest", paymentRequestSchema);
