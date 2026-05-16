import { Router } from "express";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { User } from "../../models/User.js";
import { Bet } from "../../models/Bet.js";
import { PaymentRequest } from "../../models/PaymentRequest.js";
import { Round } from "../../models/Round.js";
import { AdminLog } from "../../models/AdminLog.js";
import { Wallet } from "../../models/Wallet.js";
import { Transaction } from "../../models/Transaction.js";
import { FraudEvent } from "../../models/FraudEvent.js";
import { Notification } from "../../models/Notification.js";
import { verifyAdminToken, verifyCsrf, verifyPermission, verifyRole } from "../../middleware/adminAuth.js";

export const adminRouter = Router();
const referralCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

adminRouter.use(verifyAdminToken, verifyCsrf);

adminRouter.get("/metrics", verifyPermission("view_analytics"), async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [
      totalUsers,
      activeUsers,
      pendingDeposits,
      pendingWithdrawals,
      approvedDeposits,
      approvedWithdrawals,
      liveBets,
      todayRounds,
      fraudAlerts
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "ACTIVE" }),
      PaymentRequest.countDocuments({ type: "DEPOSIT", status: "PENDING" }),
      PaymentRequest.countDocuments({ type: "WITHDRAWAL", status: "PENDING" }),
      PaymentRequest.aggregate([
        { $match: { type: "DEPOSIT", status: "APPROVED" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      PaymentRequest.aggregate([
        { $match: { type: "WITHDRAWAL", status: "APPROVED" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Bet.aggregate([{ $match: { status: "PENDING" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Round.find({ status: "SETTLED", settledAt: { $gte: today } }).sort({ settledAt: -1 }).limit(500),
      FraudEvent.countDocuments({ status: "OPEN" })
    ]);
    const totalStake = todayRounds.reduce((sum, round) => sum + round.totalStake, 0);
    const totalPayout = todayRounds.reduce((sum, round) => sum + round.totalPayout, 0);
    res.json({
      totalUsers,
      activeUsers,
      pendingDeposits,
      pendingWithdrawals,
      totalDeposits: approvedDeposits[0]?.total || 0,
      totalWithdrawals: approvedWithdrawals[0]?.total || 0,
      liveBettingAmount: liveBets[0]?.total || 0,
      todayProfit: totalStake - totalPayout,
      fraudAlerts
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("userId fullName name mobile phone telegramUsername role accountType status isActive kycStatus vipLevel referralCode createdAt lastLoginAt createdByAdmin");
    const total = await User.countDocuments();
    res.json({ users, total, page, limit });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const userId = String(req.body.userId || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const initialBalance = Number(req.body.initialWalletBalance || 0);
    if (!userId || !password) return res.status(400).json({ error: "userId and password are required" });

    const user = await User.create({
      userId,
      fullName: req.body.fullName,
      name: req.body.fullName,
      mobile: req.body.mobile,
      phone: req.body.mobile,
      telegramUsername: req.body.telegramUsername,
      referralCode: req.body.referralCode || referralCode(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "real_user",
      accountType: "REAL",
      status: "ACTIVE",
      isActive: true,
      createdByAdmin: req.admin!.adminId
    });
    const wallet = await Wallet.create({
      userId: user._id,
      depositBalance: Math.max(0, initialBalance),
      withdrawableBalance: 0
    });
    if (initialBalance > 0) {
      await Transaction.create({
        userId: user._id,
        walletId: wallet._id,
        type: "ADMIN_ADJUSTMENT",
        amount: initialBalance,
        status: "SUCCESS",
        metadata: { reason: "Initial admin-created balance" }
      });
    }
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "CREATE_USER",
      resourceType: "User",
      resourceId: String(user._id),
      after: { userId, initialBalance },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.status(201).json({ user, wallet });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/users/:id", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const allowed = ["fullName", "mobile", "telegramUsername", "status", "isActive", "vipLevel", "kycStatus"];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (update.mobile) update.phone = update.mobile;
    if (update.fullName) update.name = update.fullName;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "EDIT_USER",
      resourceType: "User",
      resourceId: req.params.id,
      after: update,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/suspend", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: "SUSPENDED", isActive: false }, { new: true });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "SUSPEND_USER",
      resourceType: "User",
      resourceId: req.params.id,
      after: user,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/reset-password", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const password = String(req.body.password || "");
    if (!password) return res.status(400).json({ error: "password required" });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        passwordHash: await bcrypt.hash(password, 12),
        refreshTokenVersion: 0,
        $unset: { refreshTokenHash: "" }
      },
      { new: true }
    );
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "RESET_USER_PASSWORD",
      resourceType: "User",
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/payments", verifyPermission("manage_payments"), async (req, res, next) => {
  try {
    const type = req.query.type ? String(req.query.type) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const filter = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {})
    };
    const requests = await PaymentRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "name phone email");
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/transactions", verifyPermission("manage_wallets"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "userId name phone");
    const total = await Transaction.countDocuments();
    res.json({ transactions, total, page, limit });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/live-bets", verifyPermission("manage_games"), async (_req, res, next) => {
  try {
    const bets = await Bet.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "name phone email")
      .populate("roundId", "gameMode period status seedHash");
    const exposure = await Bet.aggregate([
      { $match: { status: "PENDING" } },
      { $group: { _id: "$targetValue", stake: { $sum: "$amount" }, maxPayout: { $sum: { $multiply: ["$amount", "$odds"] } } } },
      { $sort: { stake: -1 } }
    ]);
    res.json({ bets, exposure });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reports/daily-profit", verifyPermission("view_analytics"), async (_req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const rows = await Round.aggregate([
      { $match: { status: "SETTLED", settledAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$settledAt" } },
          stake: { $sum: "$totalStake" },
          payout: { $sum: "$totalPayout" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json({ rows: rows.map((row) => ({ date: row._id, stake: row.stake, payout: row.payout, profit: row.stake - row.payout })) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/reports/retention", verifyPermission("view_analytics"), async (_req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const rows = await User.aggregate([
      { $match: { lastLoginAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastLoginAt" } }, activeUsers: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ rows: rows.map((row) => ({ date: row._id, activeUsers: row.activeUsers })) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/fraud", verifyPermission("view_fraud"), async (_req, res, next) => {
  try {
    const events = await FraudEvent.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "name phone email");
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/ban", verifyPermission("manage_users"), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: "BANNED", isActive: false }, { new: true });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "BAN_USER",
      resourceType: "User",
      resourceId: req.params.id,
      after: user,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/wallet-adjust", verifyPermission("manage_wallets"), async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const reason = String(req.body.reason || "Admin adjustment");
    if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: "Invalid amount" });

    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.params.id },
      { $inc: { winningBalance: amount, withdrawableBalance: amount } },
      { new: true, upsert: true }
    );
    await Transaction.create({
      userId: req.params.id,
      walletId: wallet._id,
      type: "ADMIN_ADJUSTMENT",
      amount,
      status: "SUCCESS",
        metadata: { reason, adminId: req.admin!.adminId }
    });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "ADJUST_WALLET",
      resourceType: "Wallet",
      resourceId: String(wallet._id),
      after: { amount, reason },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ wallet });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/payments/:id/review", verifyPermission("manage_payments"), async (req, res, next) => {
  try {
    const action = String(req.body.action || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(action)) return res.status(400).json({ error: "Invalid review action" });
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Payment request not found" });
    if (request.status !== "PENDING" && request.status !== "PROCESSING") {
      return res.status(409).json({ error: "Request already reviewed" });
    }

    request.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    request.reviewedBy = req.admin!.adminId as never;
    request.reviewedAt = new Date();
    await request.save();

    if (action === "APPROVE" && request.type === "DEPOSIT") {
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
    }

    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: `${action}_${request.type}`,
      resourceType: "PaymentRequest",
      resourceId: req.params.id,
      after: request,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ request });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/bonuses", verifyPermission("manage_bonuses"), async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    const userId = req.body.userId ? String(req.body.userId) : null;
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid bonus amount" });

    const filter = userId ? { _id: userId } : { status: "ACTIVE" };
    const users = await User.find(filter).select("_id").limit(userId ? 1 : 1000);
    for (const user of users) {
      const wallet = await Wallet.findOneAndUpdate(
        { userId: user._id },
        { $inc: { bonusBalance: amount } },
        { new: true, upsert: true }
      );
      await Transaction.create({
        userId: user._id,
        walletId: wallet._id,
        type: "BONUS_CREDITED",
        amount,
        status: "SUCCESS",
        metadata: { campaign: req.body.campaign || "Admin bonus" }
      });
    }
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "CREDIT_BONUS",
      resourceType: "Bonus",
      after: { amount, userCount: users.length, campaign: req.body.campaign },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ creditedUsers: users.length });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/notifications", verifyPermission("send_notifications"), async (req, res, next) => {
  try {
    const title = String(req.body.title || "");
    const body = String(req.body.body || "");
    const userId = req.body.userId ? String(req.body.userId) : undefined;
    if (!title || !body) return res.status(400).json({ error: "Title and body are required" });

    const notification = await Notification.create({
      userId,
      title,
      body,
      channel: req.body.channel || "APP"
    });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "SEND_NOTIFICATION",
      resourceType: "Notification",
      resourceId: String(notification._id),
      after: notification,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/set-result", verifyRole("super_admin"), async (_req, res) => {
  res.status(409).json({
    success: false,
    message: "Manual result setting is disabled. Use provably fair generation and void audited rounds only."
  });
});

adminRouter.post("/rounds/:id/void", verifyPermission("manage_games"), async (req, res, next) => {
  try {
    const round = await Round.findByIdAndUpdate(req.params.id, { status: "VOID" }, { new: true });
    await AdminLog.create({
      adminId: req.admin!.adminId,
      action: "VOID_ROUND",
      resourceType: "Round",
      resourceId: req.params.id,
      after: round,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json({ round });
  } catch (error) {
    next(error);
  }
});
