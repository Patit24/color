import { Schema, model, Types } from "mongoose";

const fraudEventSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", index: true },
    eventType: { type: String, required: true, index: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
    score: { type: Number, min: 0, max: 100, default: 0 },
    evidence: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["OPEN", "REVIEWED", "RESOLVED"], default: "OPEN" },
    reviewedBy: { type: Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const FraudEvent = model("FraudEvent", fraudEventSchema);
