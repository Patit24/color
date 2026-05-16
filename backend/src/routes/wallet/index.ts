import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ensureWallet } from "../../services/walletService.js";
import { Transaction } from "../../models/Transaction.js";
import { PaymentRequest } from "../../models/PaymentRequest.js";
import { createCryptoDeposit, createRazorpayDeposit } from "../../services/paymentService.js";

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.auth!.userId);
    const ledger = await Transaction.find({ userId: req.auth!.userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ wallet, ledger });
  } catch (error) {
    next(error);
  }
});

walletRouter.post("/deposit/razorpay", async (req, res, next) => {
  try {
    const result = await createRazorpayDeposit(req.auth!.userId, Number(req.body.amount));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

walletRouter.post("/deposit/crypto", async (req, res, next) => {
  try {
    const result = await createCryptoDeposit(req.auth!.userId, Number(req.body.amount), req.body.network || "USDT_TRC20");
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

walletRouter.post("/withdraw", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const wallet = await ensureWallet(req.auth!.userId);
    if (wallet.winningBalance < amount) {
      return res.status(400).json({ error: "Insufficient winning balance" });
    }

    // Debit winning balance immediately to prevent double-spending
    wallet.winningBalance -= amount;
    await wallet.save();

    const request = await PaymentRequest.create({
      userId: req.auth!.userId,
      type: "WITHDRAWAL",
      method: req.body.method,
      amount,
      payoutAddress: req.body.payoutAddress,
      status: "PENDING"
    });

    await Transaction.create({
      userId: req.auth!.userId,
      walletId: wallet._id,
      type: "WITHDRAWAL_REQUESTED",
      amount,
      status: "PENDING",
      referenceId: String(request._id)
    });

    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
});

walletRouter.post("/deposit/razorpay/verify", async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const { verifyRazorpaySignature } = await import("../../services/paymentService.js");
    const { Transaction } = await import("../../models/Transaction.js");
    const { Wallet } = await import("../../models/Wallet.js");

    const isValid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) return res.status(400).json({ error: "Invalid signature" });

    const request = await PaymentRequest.findOne({ providerReference: razorpay_order_id });
    if (!request) return res.status(404).json({ error: "Order not found" });
    if (request.status === "APPROVED") return res.json({ success: true, message: "Already processed" });

    request.status = "APPROVED";
    request.metadata = { ...request.metadata, razorpay_payment_id };
    await request.save();

    const wallet = await Wallet.findOneAndUpdate(
      { userId: request.userId },
      { $inc: { depositBalance: request.amount } },
      { new: true, upsert: true }
    );

    await Transaction.create({
      userId: request.userId,
      walletId: wallet._id,
      type: "DEPOSIT_APPROVED",
      amount: request.amount,
      status: "SUCCESS",
      referenceId: String(request._id)
    });

    res.json({ success: true, wallet });
  } catch (error) {
    next(error);
  }
});
