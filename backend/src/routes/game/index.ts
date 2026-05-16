import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { bettingLimiter } from "../../middleware/rateLimit.js";
import { Bet } from "../../models/Bet.js";
import { Round } from "../../models/Round.js";
import { debitForBet } from "../../services/walletService.js";
import { scoreBetRequest } from "../../services/fraudService.js";

export const gameRouter = Router();

gameRouter.get("/rounds/live", async (_req, res, next) => {
  try {
    const rounds = await Round.find({ status: { $in: ["OPEN", "LOCKED"] } }).sort({ createdAt: -1 });
    res.json({ rounds });
  } catch (error) {
    next(error);
  }
});

gameRouter.get("/history", async (_req, res, next) => {
  try {
    const rounds = await Round.find({ status: "SETTLED" }).sort({ settledAt: -1 }).limit(50);
    res.json({ rounds });
  } catch (error) {
    next(error);
  }
});

gameRouter.post("/bets", requireAuth, bettingLimiter, async (req, res, next) => {
  try {
    const round = await Round.findOne({ period: req.body.period, status: "OPEN" });
    if (!round) return res.status(409).json({ error: "Round is not open" });

    const amount = Number(req.body.amount);
    const risk = await scoreBetRequest({
      userId: req.auth!.userId,
      amount,
      ipAddress: req.ip,
      deviceFingerprint: req.deviceFingerprint
    });
    if (!risk.allowed) return res.status(403).json({ error: "Bet blocked by risk rules" });

    const odds = req.body.targetType === "NUMBER" ? 9 : req.body.targetValue === "VIOLET" ? 4.5 : 2;
    const bet = await Bet.create({
      userId: req.auth!.userId,
      roundId: round._id,
      period: round.period,
      targetType: req.body.targetType,
      targetValue: req.body.targetValue,
      amount,
      odds,
      deviceFingerprint: req.deviceFingerprint,
      ipAddress: req.ip
    });
    await debitForBet(req.auth!.userId, amount, String(bet._id));
    res.status(201).json({ bet });
  } catch (error) {
    next(error);
  }
});
