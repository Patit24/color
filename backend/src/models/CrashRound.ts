import { Schema, model } from "mongoose";

const crashRoundSchema = new Schema(
  {
    roundNumber: { type: Number, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["BETTING", "RUNNING", "CRASHED", "SETTLED"],
      default: "BETTING",
      index: true
    },
    seedHash: { type: String, required: true },
    revealedSeed: { type: String },
    crashPoint: { type: Number }, // e.g. 2.43
    bettingEndsAt: { type: Date },
    startedAt: { type: Date },
    crashedAt: { type: Date },
    totalStake: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
    playerCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const CrashRound = model("CrashRound", crashRoundSchema);
