import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { bettingLimiter } from "../../middleware/rateLimit.js";
import { executeSpin } from "../../services/slotEngine.js";
import { SlotSpin } from "../../models/SlotSpin.js";

export const slotsRouter = Router();

// Spin the slot machine
slotsRouter.post("/spin", requireAuth, bettingLimiter, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 2) {
      return res.status(400).json({ error: "Minimum bet is ₹2" });
    }

    const result = await executeSpin(
      req.auth!.userId,
      amount,
      req.deviceFingerprint || "unknown",
      req.ip || "unknown"
    );

    res.json(result);
  } catch (error: any) {
    if (error.message === "Insufficient balance" || error.message.includes("bet") || error.message.includes("Bet")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Get user's spin history
slotsRouter.get("/history", requireAuth, async (req, res, next) => {
  try {
    const spins = await SlotSpin.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("betAmount reels totalWin profit isJackpot multiplier createdAt");
    res.json({ spins });
  } catch (error) {
    next(error);
  }
});

// Get slot stats
slotsRouter.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const stats = await SlotSpin.aggregate([
      { $match: { userId: req.auth!.userId } },
      {
        $group: {
          _id: null,
          totalSpins: { $sum: 1 },
          totalBet: { $sum: "$betAmount" },
          totalWon: { $sum: "$totalWin" },
          biggestWin: { $max: "$totalWin" },
          jackpots: { $sum: { $cond: ["$isJackpot", 1, 0] } }
        }
      }
    ]);
    res.json({ stats: stats[0] || { totalSpins: 0, totalBet: 0, totalWon: 0, biggestWin: 0, jackpots: 0 } });
  } catch (error) {
    next(error);
  }
});
