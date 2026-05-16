import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { User } from "../../models/User.js";
import { Wallet } from "../../models/Wallet.js";
import { Transaction } from "../../models/Transaction.js";

export const referralRouter = Router();

referralRouter.use(requireAuth);

referralRouter.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const referrals = await User.find({ referredBy: user._id }).select("userId phone createdAt").sort({ createdAt: -1 });
    const wallet = await Wallet.findOne({ userId: user._id });
    
    // Summary of earnings from referrals
    const earnings = await Transaction.find({ userId: user._id, type: "REFERRAL_BONUS" });
    const totalEarned = earnings.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({
      success: true,
      referralCode: user.referralCode,
      referralCount: referrals.length,
      referrals: referrals.map(r => ({
        id: r._id,
        phone: r.phone || r.userId,
        joinedAt: r.createdAt
      })),
      totalEarned,
      referralBalance: wallet?.referralBalance || 0
    });
  } catch (error) {
    next(error);
  }
});

referralRouter.post("/claim", async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.auth!.userId });
    if (!wallet || wallet.referralBalance <= 0) {
      return res.status(400).json({ success: false, message: "No referral balance to claim" });
    }

    const amount = wallet.referralBalance;
    wallet.referralBalance = 0;
    wallet.winningBalance += amount; // Transfer to winnings for withdrawal
    await wallet.save();

    await Transaction.create({
      userId: req.auth!.userId,
      walletId: wallet._id,
      type: "REFERRAL_CLAIM",
      amount,
      status: "SUCCESS",
      referenceId: "INTERNAL_TRANSFER"
    });

    res.json({ success: true, amount, message: "Referral balance claimed to winning wallet." });
  } catch (error) {
    next(error);
  }
});
