import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { bettingLimiter } from "../../middleware/rateLimit.js";
import { executeJackpotSpin, getJackpotPool } from "../../services/jackpotEngine.js";
import { JackpotSpin } from "../../models/JackpotSpin.js";

export const jackpotRouter = Router();

// ─── Jackpot Pool (public) ────────────────────────────────────────
jackpotRouter.get("/pool", async (_req, res, next) => {
  try {
    const pool = await getJackpotPool();
    res.json({ pool });
  } catch (error) {
    next(error);
  }
});

// ─── Spin ─────────────────────────────────────────────────────────
jackpotRouter.post("/spin", requireAuth, bettingLimiter, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 2) {
      return res.status(400).json({ error: "Minimum bet is ₹2" });
    }

    const result = await executeJackpotSpin(
      req.auth!.userId,
      amount,
      req.deviceFingerprint || "unknown",
      req.ip || "unknown"
    );

    res.json(result);
  } catch (error: any) {
    if (
      error.message === "Insufficient balance" ||
      error.message.includes("bet") ||
      error.message.includes("Bet")
    ) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ─── History ──────────────────────────────────────────────────────
jackpotRouter.get("/history", requireAuth, async (req, res, next) => {
  try {
    const spins = await JackpotSpin.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("betAmount totalWin profit jackpotType jackpotWin bonusTriggered bonusTotal multiplier createdAt");
    res.json({ spins });
  } catch (error) {
    next(error);
  }
});

// ─── Stats ────────────────────────────────────────────────────────
jackpotRouter.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const stats = await JackpotSpin.aggregate([
      { $match: { userId: req.auth!.userId } },
      {
        $group: {
          _id: null,
          totalSpins: { $sum: 1 },
          totalBet: { $sum: "$betAmount" },
          totalWon: { $sum: "$totalWin" },
          biggestWin: { $max: "$totalWin" },
          jackpotsMini: { $sum: { $cond: [{ $eq: ["$jackpotType", "MINI"] }, 1, 0] } },
          jackpotsMajor: { $sum: { $cond: [{ $eq: ["$jackpotType", "MAJOR"] }, 1, 0] } },
          jackpotsMega: { $sum: { $cond: [{ $eq: ["$jackpotType", "MEGA"] }, 1, 0] } },
          bonusRounds: { $sum: { $cond: ["$bonusTriggered", 1, 0] } },
        },
      },
    ]);
    res.json({
      stats: stats[0] || {
        totalSpins: 0,
        totalBet: 0,
        totalWon: 0,
        biggestWin: 0,
        jackpotsMini: 0,
        jackpotsMajor: 0,
        jackpotsMega: 0,
        bonusRounds: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});
