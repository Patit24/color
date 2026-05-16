import mongoose from "mongoose";
import { Wallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";

export async function ensureWallet(userId: string) {
  return Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true }
  );
}

export async function debitForBet(userId: string, amount: number, referenceId: string) {
  const session = await mongoose.startSession();
  return session.withTransaction(async () => {
    const wallet = await ensureWallet(userId);
    const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;
    if (total < amount) throw new Error("Insufficient balance");

    let remaining = amount;
    const bonusDebit = Math.min(wallet.bonusBalance, remaining);
    remaining -= bonusDebit;
    const depositDebit = Math.min(wallet.depositBalance, remaining);
    remaining -= depositDebit;
    const winningDebit = remaining;

    wallet.bonusBalance -= bonusDebit;
    wallet.depositBalance -= depositDebit;
    wallet.winningBalance -= winningDebit;
    await wallet.save({ session });

    await Transaction.create(
      [
        {
          userId,
          walletId: wallet._id,
          type: "BET_PLACED",
          amount: -amount,
          status: "SUCCESS",
          referenceId
        }
      ],
      { session }
    );

    return wallet;
  }).finally(() => session.endSession());
}

export async function creditWinnings(userId: string, amount: number, referenceId: string) {
  const wallet = await ensureWallet(userId);
  wallet.winningBalance += amount;
  wallet.withdrawableBalance += amount;
  await wallet.save();
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: "BET_WON",
    amount,
    status: "SUCCESS",
    referenceId
  });
  return wallet;
}
