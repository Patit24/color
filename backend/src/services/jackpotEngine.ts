import crypto from "node:crypto";
import { JackpotSpin } from "../models/JackpotSpin.js";
import { SlotSpin } from "../models/SlotSpin.js";
import { Wallet } from "../models/Wallet.js";
import { debitForBet, creditWinnings } from "./walletService.js";
import { User } from "../models/User.js";
import { createFirestoreTransaction, createFirestoreBet } from "./firebase.js";

// ─── Symbol Definitions ──────────────────────────────────────────
export const JP_SYMBOLS = ["cherry", "lemon", "bell", "seven", "diamond", "chest", "crown"] as const;
export type JpSymbol = (typeof JP_SYMBOLS)[number];

const JP_WEIGHTS: Record<JpSymbol, number> = {
  cherry: 30,
  lemon: 28,
  bell: 18,
  seven: 10,
  diamond: 6,
  chest: 5,   // triggers bonus round
  crown: 3,   // high-value symbol
};

const JP_PAYOUTS: Record<JpSymbol, number> = {
  cherry: 0.4,
  lemon: 0.6,
  bell: 1.0,
  seven: 3.0,
  diamond: 10.0,
  chest: 0,   // bonus – no line payout
  crown: 15.0,
};

const TOTAL_JP_WEIGHT = Object.values(JP_WEIGHTS).reduce((a, b) => a + b, 0);

// ─── 3-reel, 3-row paylines ──────────────────────────────────────
const JP_PAYLINES: number[][] = [
  [1, 1, 1], // middle straight
  [0, 0, 0], // top straight
  [2, 2, 2], // bottom straight
  [0, 1, 2], // diagonal down
  [2, 1, 0], // diagonal up
];

// ─── Global Jackpot Pool (in-memory, persisted via DB aggregate) ──
// Each bet contributes 3% to the jackpot pool
const JACKPOT_CONTRIBUTION_RATE = 0.03;

// Jackpot thresholds
const JACKPOT_THRESHOLDS = {
  MINI:  { min: 100,  max: 499 },
  MAJOR: { min: 500,  max: 1999 },
  MEGA:  { min: 2000, max: 9999 },
};

// ─── RNG ──────────────────────────────────────────────────────────
function pickJpSymbol(seed: Buffer, offset: number): JpSymbol {
  const value = seed.readUInt16BE(offset % (seed.length - 1)) % TOTAL_JP_WEIGHT;
  let cumulative = 0;
  for (const [symbol, weight] of Object.entries(JP_WEIGHTS)) {
    cumulative += weight;
    if (value < cumulative) return symbol as JpSymbol;
  }
  return "cherry";
}

function generateJpReels(seed: string): JpSymbol[][] {
  const hash = crypto.createHash("sha512").update(seed).digest();
  const reels: JpSymbol[][] = [];
  for (let col = 0; col < 3; col++) {
    const reel: JpSymbol[] = [];
    for (let row = 0; row < 3; row++) {
      reel.push(pickJpSymbol(hash, col * 6 + row * 2));
    }
    reels.push(reel);
  }
  return reels;
}

// ─── Payline Evaluation ───────────────────────────────────────────
function evaluateJpPaylines(reels: JpSymbol[]) {
  const results: Array<{ lineIndex: number; symbols: JpSymbol[]; payout: number }> = [];
  let totalMultiplier = 0;

  for (let i = 0; i < JP_PAYLINES.length; i++) {
    const line = JP_PAYLINES[i];
    const symbols: JpSymbol[] = line.map((row, col) => reels[col * 3 + row]);

    const nonChest = symbols.filter((s) => s !== "chest");
    if (nonChest.length === 0) continue;

    const dominant = nonChest[0];
    let matchCount = 0;
    for (const sym of symbols) {
      if (sym === dominant) matchCount++;
      else break;
    }

    if (matchCount === 3) {
      const linePayout = JP_PAYOUTS[dominant];
      if (linePayout > 0) {
        totalMultiplier += linePayout;
        results.push({ lineIndex: i, symbols, payout: linePayout });
      }
    }
  }

  // Scatter: 3 chests anywhere = bonus round
  const chestCount = reels.filter((s) => s === "chest").length;
  const bonusTriggered = chestCount >= 3;

  return { paylines: results, totalMultiplier, bonusTriggered };
}

// ─── Get live jackpot pool ────────────────────────────────────────
export async function getJackpotPool(): Promise<{
  mini: number;
  major: number;
  mega: number;
}> {
  // Aggregate contributions from all bets
  const result = await JackpotSpin.aggregate([
    {
      $group: {
        _id: null,
        totalContribution: { $sum: { $multiply: ["$betAmount", JACKPOT_CONTRIBUTION_RATE] } },
        totalJackpotWon: { $sum: "$jackpotWin" },
      },
    },
  ]);

  const net = result[0]
    ? result[0].totalContribution - result[0].totalJackpotWon
    : 0;

  // Split: MINI 15%, MAJOR 35%, MEGA 50%
  const safeNet = Math.max(net, 0);
  return {
    mini:  Math.round(Math.max(100,  safeNet * 0.15)),
    major: Math.round(Math.max(500,  safeNet * 0.35)),
    mega:  Math.round(Math.max(2000, safeNet * 0.50)),
  };
}

// ─── Bonus Pick Round ─────────────────────────────────────────────
function generateBonusPicks(betAmount: number): { chestIndex: number; reward: number }[] {
  const picks: { chestIndex: number; reward: number }[] = [];
  const usedIndices = new Set<number>();
  for (let i = 0; i < 6; i++) {
    let idx: number;
    do { idx = Math.floor(Math.random() * 9); } while (usedIndices.has(idx));
    usedIndices.add(idx);
    // reward: 50%–200% of bet, with a rare 6x
    const roll = Math.random();
    let reward: number;
    if (roll < 0.08) reward = Math.round(betAmount * 6);
    else if (roll < 0.25) reward = Math.round(betAmount * (1.5 + Math.random() * 1.5));
    else reward = Math.round(betAmount * (0.5 + Math.random() * 1.5));
    picks.push({ chestIndex: idx, reward });
  }
  return picks;
}

// ─── Main Jackpot Spin ────────────────────────────────────────────
export async function executeJackpotSpin(
  userId: string,
  betAmount: number,
  deviceFingerprint: string,
  ip: string
) {
  if (betAmount < 2) throw new Error("Minimum bet is ₹2");
  if (betAmount > 10000) throw new Error("Maximum bet is ₹10,000");

  // Fetch user's total spin count across both slot types to implement strict payout control
  const totalSpinsLucky = await SlotSpin.countDocuments({ userId });
  const totalSpinsJackpot = await JackpotSpin.countDocuments({ userId });
  const totalSpins = totalSpinsLucky + totalSpinsJackpot;

  // Retrieve user document and wallet balance to apply custom win triggers
  const userDoc = await User.findById(userId);
  const wallet = await Wallet.findOne({ userId });
  const depositWinBalanceBeforeBet = wallet ? (wallet.depositBalance + wallet.winningBalance) : 0;
  const depositWinBalanceAfterBet = depositWinBalanceBeforeBet - betAmount;

  // Rule Definitions:
  // 1. Near bankruptcy saver (first time balance is about to end): max ₹150 win (₹80–₹150)
  const isNearBankruptcySaver = depositWinBalanceAfterBet < 15 && userDoc && !userDoc.get("bankruptcyRecoveryTriggered");

  // 2. Periodic Mega Win: every 2000 spins overall gets ₹800–₹1000 win
  const isMega2000Spin = (totalSpins + 1) % 2000 === 0;

  // 3. New Account Reward: within first 3-4 spins (say when totalSpins === 1), get ₹20–₹50 win
  const isNewUserRewardSpin = totalSpins === 1 && userDoc && !userDoc.get("newUserRewardTriggered");

  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  // Flat reels array (3 reels × 3 rows = 9 positions)
  let flatReels = generateJpReels(seed).flat();
  let evalResult = evaluateJpPaylines(flatReels);

  const isSpecialSpin = isMega2000Spin || isNearBankruptcySaver || isNewUserRewardSpin;
  let targetType: "MASSIVE" | "BIG" | "BONUS" | "NORMAL" | "LOSS" = "LOSS";

  if (isSpecialSpin) {
    if (isMega2000Spin) {
      targetType = "MASSIVE";
      const forcedTargetWin = Math.floor(Math.random() * (1000 - 800 + 1)) + 800; // ₹800 to ₹1000
      const targetMult = forcedTargetWin / betAmount;
      flatReels = ["diamond", "bell", "cherry", "crown", "crown", "crown", "bell", "lemon", "cherry"];
      evalResult = {
        paylines: [{ lineIndex: 0, symbols: ["crown", "crown", "crown"] as JpSymbol[], payout: targetMult }],
        totalMultiplier: targetMult,
        bonusTriggered: false
      };
    } else if (isNearBankruptcySaver) {
      targetType = "BIG";
      const forcedTargetWin = Math.floor(Math.random() * (150 - 80 + 1)) + 80; // ₹80 to ₹150
      const targetMult = forcedTargetWin / betAmount;
      flatReels = ["bell", "lemon", "cherry", "seven", "seven", "seven", "bell", "lemon", "cherry"];
      evalResult = {
        paylines: [{ lineIndex: 0, symbols: ["seven", "seven", "seven"] as JpSymbol[], payout: targetMult }],
        totalMultiplier: targetMult,
        bonusTriggered: false
      };
    } else if (isNewUserRewardSpin) {
      targetType = "NORMAL";
      const forcedTargetWin = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // ₹20 to ₹50
      const targetMult = forcedTargetWin / betAmount;
      flatReels = ["cherry", "lemon", "cherry", "bell", "bell", "bell", "lemon", "cherry", "seven"];
      evalResult = {
        paylines: [{ lineIndex: 0, symbols: ["bell", "bell", "bell"] as JpSymbol[], payout: targetMult }],
        totalMultiplier: targetMult,
        bonusTriggered: false
      };
    }
  } else {
    // Payout control
    const isMassiveSpin = totalSpins > 0 && totalSpins % 150 === 0;
    const isBigSpin = !isMassiveSpin && totalSpins > 0 && totalSpins % 30 === 0;
    const isBonusSpin = !isMassiveSpin && !isBigSpin && totalSpins > 0 && totalSpins % 60 === 0;

    if (isMassiveSpin) targetType = "MASSIVE";
    else if (isBigSpin) targetType = "BIG";
    else if (isBonusSpin) targetType = "BONUS";
    else targetType = Math.random() < 0.35 ? "NORMAL" : "LOSS"; // 35% normal spin hit rate

    let attempts = 0;
    let currentSeed = seed;

    const isValid = (type: typeof targetType, mult: number, currentReels: JpSymbol[]) => {
      const win = Math.round(betAmount * mult);
      switch (type) {
        case "MASSIVE": return mult >= 30 && mult <= 100;
        case "BIG":     return mult >= 8  && mult <= 20;
        case "BONUS":
          // Chest count >= 3 triggers scatter bonus round
          const chestCount = currentReels.filter((s) => s === "chest").length;
          return chestCount >= 3;
        case "NORMAL":  return win > 0    && mult <= 1.5;
        case "LOSS":
        default:        return win === 0;
      }
    };

    while (!isValid(targetType, evalResult.totalMultiplier, flatReels) && attempts < 150) {
      currentSeed = crypto.createHash("sha256").update(currentSeed).digest("hex");
      flatReels = generateJpReels(currentSeed).flat();
      evalResult = evaluateJpPaylines(flatReels);
      attempts++;
    }

    // Fallback forced layouts
    if (!isValid(targetType, evalResult.totalMultiplier, flatReels)) {
      if (targetType === "LOSS") {
        flatReels = ["cherry", "lemon", "bell", "seven", "cherry", "lemon", "bell", "lemon", "seven"];
        evalResult = evaluateJpPaylines(flatReels as JpSymbol[]);
      } else if (targetType === "NORMAL") {
        flatReels = ["lemon", "cherry", "seven", "lemon", "cherry", "bell", "lemon", "cherry", "seven"];
        evalResult = evaluateJpPaylines(flatReels as JpSymbol[]);
      } else if (targetType === "BONUS") {
        // Force exactly 3 chests layout to trigger the bonus round
        flatReels = ["chest", "cherry", "lemon", "bell", "chest", "seven", "diamond", "cherry", "chest"];
        evalResult = evaluateJpPaylines(flatReels as JpSymbol[]);
      } else if (targetType === "BIG") {
        const targetMult = Math.floor(Math.random() * 13) + 8; // 8x to 20x
        evalResult = { paylines: [{ lineIndex: 0, symbols: ["seven", "seven", "seven"] as JpSymbol[], payout: targetMult }], totalMultiplier: targetMult, bonusTriggered: false };
        flatReels = ["seven", "seven", "seven", "lemon", "bell", "cherry", "bell", "lemon", "cherry"];
      } else {
        const targetMult = Math.floor(Math.random() * (100 - 30 + 1)) + 30; // 30x to 100x
        evalResult = { paylines: [{ lineIndex: 0, symbols: ["crown", "crown", "crown"] as JpSymbol[], payout: targetMult }], totalMultiplier: targetMult, bonusTriggered: false };
        flatReels = ["crown", "crown", "crown", "diamond", "bell", "cherry", "bell", "lemon", "cherry"];
      }
    }
  }

  const { paylines, totalMultiplier, bonusTriggered } = evalResult;

  // ─── Jackpot check ────────────────────────────────────────────
  let jackpotType: "NONE" | "MINI" | "MAJOR" | "MEGA" = "NONE";
  let jackpotWin = 0;

  // Jackpot triggers: 5 crown symbols on MASSIVE spin (very rare)
  const crownCount = flatReels.filter((s) => s === "crown").length;
  if (crownCount >= 3 && targetType === "MASSIVE") {
    const pool = await getJackpotPool();
    const roll = Math.random();
    if (roll < 0.005) {
      jackpotType = "MEGA";
      jackpotWin = pool.mega;
    } else if (roll < 0.025) {
      jackpotType = "MAJOR";
      jackpotWin = pool.major;
    } else if (roll < 0.10) {
      jackpotType = "MINI";
      jackpotWin = pool.mini;
    }
  }

  // ─── Bonus round ──────────────────────────────────────────────
  let bonusPicks: { chestIndex: number; reward: number }[] = [];
  let bonusTotal = 0;
  if (bonusTriggered) {
    bonusPicks = generateBonusPicks(betAmount);
    bonusTotal = bonusPicks.slice(0, 3).reduce((s, p) => s + p.reward, 0); // pick 3 of 6
  }

  const baseWin = Math.round(betAmount * totalMultiplier);
  const totalWin = baseWin + jackpotWin + bonusTotal;
  const profit = totalWin - betAmount;

  // Reshape flat reels back to 3×3
  const reels2d: JpSymbol[][] = [
    flatReels.slice(0, 3) as JpSymbol[],
    flatReels.slice(3, 6) as JpSymbol[],
    flatReels.slice(6, 9) as JpSymbol[],
  ];

  const spin = await JackpotSpin.create({
    userId,
    betAmount,
    reels: reels2d,
    paylines,
    totalWin,
    profit,
    jackpotType,
    jackpotWin,
    bonusTriggered,
    bonusPicks,
    bonusTotal,
    multiplier: totalMultiplier,
    seedHash,
    deviceFingerprint,
    ipAddress: ip,
  });

  // Update Mongoose triggers if applicable
  if (isNearBankruptcySaver) {
    await User.findByIdAndUpdate(userId, { bankruptcyRecoveryTriggered: true });
  }
  if (isNewUserRewardSpin) {
    await User.findByIdAndUpdate(userId, { newUserRewardTriggered: true });
  }

  await debitForBet(userId, betAmount, String(spin._id));
  if (totalWin > 0) await creditWinnings(userId, totalWin, String(spin._id));

  // Firestore sync
  try {
    const user = await User.findById(userId).select("firebaseUid");
    if (user?.firebaseUid) {
      await createFirestoreBet(user.firebaseUid, {
        period: `jackpot_${spin._id}`,
        selection: "JACKPOT_SLOTS",
        amount: betAmount,
        status: totalWin > 0 ? "Won" : "Lost",
        profit: totalWin,
      });
      await createFirestoreTransaction(user.firebaseUid, {
        type: "JACKPOT_BET",
        amount: -betAmount,
        status: "SUCCESS",
      });
      if (totalWin > 0) {
        await createFirestoreTransaction(user.firebaseUid, {
          type: "JACKPOT_WIN",
          amount: totalWin,
          status: "SUCCESS",
        });
      }
    }
  } catch (err: any) {
    console.warn("Jackpot Firestore sync failed:", err.message);
  }

  return {
    spinId: spin._id,
    reels: reels2d,
    paylines,
    totalWin,
    profit,
    jackpotType,
    jackpotWin,
    bonusTriggered,
    bonusPicks,
    bonusTotal,
    multiplier: totalMultiplier,
    betAmount,
  };
}
