import mongoose from "mongoose";
import { Wallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { getFirestoreWallet, updateFirestoreWallet } from "./firebase.js";
import { env } from "../config/env.js";

export async function ensureWallet(userId: string, session?: mongoose.ClientSession) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session }
  );

  // Sync from Firestore if user has a linked firebaseUid
  try {
    const user = await User.findById(userId, null, { session }).select("firebaseUid");
    if (user?.firebaseUid) {
      const fsWallet = await getFirestoreWallet(user.firebaseUid);
      if (fsWallet) {
        wallet.depositBalance = fsWallet.depositBalance;
        wallet.winningBalance = fsWallet.winningBalance;
        wallet.bonusBalance = fsWallet.bonusBalance;
        wallet.withdrawableBalance = fsWallet.winningBalance;
        await wallet.save({ session });
      }
    }
  } catch (error: any) {
    console.warn("Firestore sync in ensureWallet skipped/failed:", error.message);
  }

  // If in-memory Mongo or development mode and balances are all 0, seed with ₹10,000 play money
  if (
    (env.NODE_ENV === "development" || env.MONGO_URI === "memory") &&
    wallet.depositBalance === 0 &&
    wallet.winningBalance === 0 &&
    wallet.bonusBalance === 0
  ) {
    wallet.depositBalance = 10000;
    wallet.withdrawableBalance = 10000;
    await wallet.save({ session });
    console.log(`[Dev Wallet] Seeded play money ₹10,000 for user ${userId}`);
  }

  return wallet;
}

export async function debitForBet(userId: string, amount: number, referenceId: string) {
  const session = await mongoose.startSession();
  let walletAfterSave: any = null;

  try {
    await session.withTransaction(async () => {
      const wallet = await ensureWallet(userId, session);
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
      wallet.withdrawableBalance = wallet.winningBalance;
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

      walletAfterSave = wallet;
    });
  } finally {
    session.endSession();
  }

  // Sync updated wallet balance back to Firestore outside of the transaction session
  if (walletAfterSave) {
    try {
      const user = await User.findById(userId).select("firebaseUid");
      if (user?.firebaseUid) {
        await updateFirestoreWallet(user.firebaseUid, {
          depositBalance: walletAfterSave.depositBalance,
          winningBalance: walletAfterSave.winningBalance,
          bonusBalance: walletAfterSave.bonusBalance,
        });
      }
    } catch (error: any) {
      console.warn("Firestore sync in debitForBet failed:", error.message);
    }
  }

  return walletAfterSave;
}

export async function creditWinnings(userId: string, amount: number, referenceId: string) {
  const session = await mongoose.startSession();
  let walletAfterSave: any = null;

  try {
    await session.withTransaction(async () => {
      const wallet = await ensureWallet(userId, session);
      wallet.winningBalance += amount;
      wallet.withdrawableBalance = wallet.winningBalance;
      await wallet.save({ session });
      
      await Transaction.create([
        {
          userId,
          walletId: wallet._id,
          type: "BET_WON",
          amount,
          status: "SUCCESS",
          referenceId
        }
      ], { session });

      walletAfterSave = wallet;
    });
  } finally {
    session.endSession();
  }

  // Sync updated wallet balance back to Firestore
  if (walletAfterSave) {
    try {
      const user = await User.findById(userId).select("firebaseUid");
      if (user?.firebaseUid) {
        await updateFirestoreWallet(user.firebaseUid, {
          depositBalance: walletAfterSave.depositBalance,
          winningBalance: walletAfterSave.winningBalance,
          bonusBalance: walletAfterSave.bonusBalance,
        });
      }
    } catch (error: any) {
      console.warn("Firestore sync in creditWinnings failed:", error.message);
    }
  }

  return walletAfterSave;
}
