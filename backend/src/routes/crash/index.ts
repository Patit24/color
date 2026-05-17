import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { CrashRound } from "../../models/CrashRound.js";
import { CrashBet } from "../../models/CrashBet.js";

export const crashRouter = Router();

// Get crash game history
crashRouter.get("/history", async (_req, res, next) => {
  try {
    const rounds = await CrashRound.find({ status: { $in: ["CRASHED", "SETTLED"] } })
      .sort({ crashedAt: -1 })
      .limit(50)
      .select("roundNumber crashPoint playerCount totalStake totalPayout crashedAt seedHash revealedSeed");
    res.json({ rounds });
  } catch (error) {
    next(error);
  }
});

// Get current round info
crashRouter.get("/current", async (_req, res, next) => {
  try {
    const round = await CrashRound.findOne({ status: { $in: ["BETTING", "RUNNING"] } })
      .sort({ createdAt: -1 })
      .select("roundNumber status seedHash bettingEndsAt startedAt");
    res.json({ round });
  } catch (error) {
    next(error);
  }
});

// Get user's crash bet history
crashRouter.get("/my-bets", requireAuth, async (req, res, next) => {
  try {
    const bets = await CrashBet.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("roundId", "roundNumber crashPoint");
    res.json({ bets });
  } catch (error) {
    next(error);
  }
});
