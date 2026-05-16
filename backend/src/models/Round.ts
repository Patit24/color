import { Schema, model } from "mongoose";

const roundSchema = new Schema(
  {
    gameMode: { type: String, enum: ["30S", "1M", "3M", "5M"], required: true, index: true },
    period: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "OPEN", "LOCKED", "RESULT_GENERATED", "SETTLED", "VOID"],
      default: "SCHEDULED",
      index: true
    },
    seedHash: { type: String, required: true },
    revealedSeed: { type: String },
    resultNumber: { type: Number, min: 0, max: 9 },
    resultColor: { type: String, enum: ["RED", "GREEN", "VIOLET"] },
    resultColors: [{ type: String, enum: ["RED", "GREEN", "VIOLET"] }],
    resultSize: { type: String, enum: ["BIG", "SMALL"] },
    bettingOpenedAt: { type: Date },
    bettingLockedAt: { type: Date },
    settledAt: { type: Date },
    totalStake: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Round = model("Round", roundSchema);
