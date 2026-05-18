import crypto from "node:crypto";
import { SlotSpin } from "../models/SlotSpin.js";
import { JackpotSpin } from "../models/JackpotSpin.js";
import { Wallet } from "../models/Wallet.js";
import { debitForBet, creditWinnings } from "./walletService.js";
import { User } from "../models/User.js";
import { createFirestoreTransaction, createFirestoreBet } from "./firebase.js";

// ─── Symbol Definitions ──────────────────────────────────────
export const SYMBOLS = ["cherry", "lemon", "bell", "seven", "diamond", "wild", "scatter"] as const;
export type SlotSymbol = (typeof SYMBOLS)[number];

const WEIGHTS: Record<SlotSymbol, number> = {
  cherry: 35,
  lemon: 30,
  bell: 15,
  seven: 10,
  diamond: 5,
  wild: 4,
  scatter: 1,
};

const PAYOUTS: Record<SlotSymbol, number> = {
  cherry: 0.3,
  lemon: 0.5,
  bell: 0.8,
  seven: 2.0,
  diamond: 10.0,
  wild: 0, // wild substitutes
  scatter: 0, // scatter gives free spins bonus
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// ─── Paylines (20 lines across 5 reels x 3 rows) ──────────
// Each payline is an array of 5 row indices (0=top, 1=mid, 2=bottom)
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle straight
  [0, 0, 0, 0, 0], // top straight
  [2, 2, 2, 2, 2], // bottom straight
  [0, 1, 2, 1, 0], // V shape
  [2, 1, 0, 1, 2], // inverted V
  [0, 0, 1, 0, 0], // slight dip
  [2, 2, 1, 2, 2], // slight rise
  [1, 0, 0, 0, 1], // U shape
  [1, 2, 2, 2, 1], // inverted U
  [0, 1, 0, 1, 0], // zigzag top
  [2, 1, 2, 1, 2], // zigzag bottom
  [1, 0, 1, 0, 1], // wave top
  [1, 2, 1, 2, 1], // wave bottom
  [0, 1, 1, 1, 0], // flat middle V
  [2, 1, 1, 1, 2], // flat middle A
  [0, 0, 1, 2, 2], // diagonal down
  [2, 2, 1, 0, 0], // diagonal up
  [1, 0, 1, 2, 1], // W shape
  [0, 2, 0, 2, 0], // deep zigzag
  [2, 0, 2, 0, 2], // deep zigzag inv
];

// ─── RNG Functions ───────────────────────────────────────────
function pickSymbol(seed: Buffer, offset: number): SlotSymbol {
  const value = seed.readUInt16BE(offset % (seed.length - 1)) % TOTAL_WEIGHT;
  let cumulative = 0;
  for (const [symbol, weight] of Object.entries(WEIGHTS)) {
    cumulative += weight;
    if (value < cumulative) return symbol as SlotSymbol;
  }
  return "cherry";
}

function generateReels(seed: string): SlotSymbol[][] {
  const hash = crypto.createHash("sha512").update(seed).digest();
  const reels: SlotSymbol[][] = [];
  for (let col = 0; col < 5; col++) {
    const reel: SlotSymbol[] = [];
    for (let row = 0; row < 3; row++) {
      reel.push(pickSymbol(hash, col * 6 + row * 2));
    }
    reels.push(reel);
  }
  return reels;
}

// ─── Payline Evaluation ──────────────────────────────────────
function evaluatePaylines(reels: SlotSymbol[][]) {
  const results: Array<{ lineIndex: number; symbols: SlotSymbol[]; payout: number }> = [];
  let totalMultiplier = 0;
  let isJackpot = false;

  for (let i = 0; i < PAYLINES.length; i++) {
    const line = PAYLINES[i];
    const symbols: SlotSymbol[] = line.map((row, col) => reels[col][row]);

    // Resolve wilds: find the dominant non-wild symbol
    const nonWild = symbols.filter((s) => s !== "wild" && s !== "scatter");
    if (nonWild.length === 0) continue;

    const targetSymbol = nonWild[0];
    let matchCount = 0;

    for (const sym of symbols) {
      if (sym === targetSymbol || sym === "wild") matchCount++;
      else break; // consecutive from left
    }

    if (matchCount >= 3) {
      let linePayout = PAYOUTS[targetSymbol] * (matchCount - 2); // 3=1x, 4=2x, 5=3x base
      const wildCount = symbols.slice(0, matchCount).filter((s) => s === "wild").length;
      linePayout *= 1 + wildCount * 0.5; // wild bonus multiplier

      totalMultiplier += linePayout;
      results.push({ lineIndex: i, symbols, payout: linePayout });
    }
  }

  // Check for scatter bonus (3+ scatters anywhere)
  const scatterCount = reels.flat().filter((s) => s === "scatter").length;
  if (scatterCount >= 3) {
    const scatterPayout = scatterCount === 3 ? 0.1 : scatterCount === 4 ? 0.25 : 0.5;
    totalMultiplier += scatterPayout;
    results.push({
      lineIndex: -1,
      symbols: Array(5).fill("scatter") as SlotSymbol[],
      payout: scatterPayout
    });
  }

  // Jackpot: 5 diamonds on any payline
  const jackpotLine = results.find(
    (r) => r.symbols.filter((s) => s === "diamond" || s === "wild").length === 5
  );
  if (jackpotLine) isJackpot = true;

  return { paylines: results, totalMultiplier, isJackpot };
}

// ─── Main Spin Function ──────────────────────────────────────
export async function executeSpin(
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

  // Generate reels
  let reels = generateReels(seed);
  let evalResult = evaluatePaylines(reels);

  const isSpecialSpin = isMega2000Spin || isNearBankruptcySaver || isNewUserRewardSpin;

  if (isSpecialSpin) {
    if (isMega2000Spin) {
      const forcedTargetWin = Math.floor(Math.random() * (1000 - 800 + 1)) + 800; // ₹800 to ₹1000
      const targetMult = forcedTargetWin / betAmount;
      reels = [
        ["diamond", "diamond", "bell"],
        ["cherry", "diamond", "scatter"],
        ["lemon", "diamond", "bell"],
        ["diamond", "diamond", "cherry"],
        ["bell", "diamond", "seven"]
      ];
      evalResult = {
        paylines: [
          {
            lineIndex: 0,
            symbols: ["diamond", "diamond", "diamond", "diamond", "diamond"] as SlotSymbol[],
            payout: targetMult
          }
        ],
        totalMultiplier: targetMult,
        isJackpot: true
      };
    } else if (isNearBankruptcySaver) {
      const forcedTargetWin = Math.floor(Math.random() * (150 - 80 + 1)) + 80; // ₹80 to ₹150
      const targetMult = forcedTargetWin / betAmount;
      reels = [
        ["lemon", "seven", "bell"],
        ["cherry", "seven", "scatter"],
        ["lemon", "seven", "bell"],
        ["seven", "seven", "cherry"],
        ["bell", "seven", "seven"]
      ];
      evalResult = {
        paylines: [
          {
            lineIndex: 0,
            symbols: ["seven", "seven", "seven", "seven", "seven"] as SlotSymbol[],
            payout: targetMult
          }
        ],
        totalMultiplier: targetMult,
        isJackpot: false
      };
    } else if (isNewUserRewardSpin) {
      const forcedTargetWin = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // ₹20 to ₹50
      const targetMult = forcedTargetWin / betAmount;
      reels = [
        ["lemon", "bell", "cherry"],
        ["seven", "bell", "scatter"],
        ["lemon", "bell", "bell"],
        ["seven", "bell", "cherry"],
        ["bell", "lemon", "seven"]
      ];
      evalResult = {
        paylines: [
          {
            lineIndex: 0,
            symbols: ["bell", "bell", "bell", "bell", "lemon"] as SlotSymbol[],
            payout: targetMult
          }
        ],
        totalMultiplier: targetMult,
        isJackpot: false
      };
    }
  } else {
    // Normal / periodic slots payout distribution logic
    const isMassiveSpin = totalSpins > 0 && totalSpins % 150 === 0;
    const isBigSpin = !isMassiveSpin && totalSpins > 0 && totalSpins % 30 === 0;
    const isBonusSpin = !isMassiveSpin && !isBigSpin && totalSpins > 0 && totalSpins % 50 === 0;
    
    // Decide target spin type
    let targetSpinType: "MASSIVE" | "BIG" | "BONUS" | "NORMAL" | "LOSS" = "LOSS";
    if (isMassiveSpin) {
      targetSpinType = "MASSIVE";
    } else if (isBigSpin) {
      targetSpinType = "BIG";
    } else if (isBonusSpin) {
      targetSpinType = "BONUS";
    } else {
      // 35% hit frequency for small normal wins to satisfy 28%-40% range beautifully
      targetSpinType = Math.random() < 0.35 ? "NORMAL" : "LOSS";
    }

    let attempts = 0;
    let currentSeed = seed;

    const isValidSpinForType = (type: typeof targetSpinType, multiplier: number, currentReels: SlotSymbol[][]) => {
      const winAmount = Math.round(betAmount * multiplier);
      switch (type) {
        case "MASSIVE":
          // 30x to 100x bet for massive win
          return multiplier >= 30 && multiplier <= 100;
        case "BIG":
          // 8x to 20x bet for big win
          return multiplier >= 8 && multiplier <= 20;
        case "BONUS":
          // Bonus triggers free spins (3+ scatters)
          const scatterCount = currentReels.flat().filter((s) => s === "scatter").length;
          return scatterCount >= 3;
        case "NORMAL":
          return winAmount > 0 && multiplier <= 1.5;
        case "LOSS":
        default:
          return winAmount === 0;
      }
    };

    // Run the generator loop to find a spin matching the target type
    while (!isValidSpinForType(targetSpinType, evalResult.totalMultiplier, reels) && attempts < 150) {
      currentSeed = crypto.createHash("sha256").update(currentSeed).digest("hex");
      reels = generateReels(currentSeed);
      evalResult = evaluatePaylines(reels);
      attempts++;
    }

    // Fallback if target type was not found after 150 random attempts:
    if (!isValidSpinForType(targetSpinType, evalResult.totalMultiplier, reels)) {
      if (targetSpinType === "LOSS") {
        // Force flat loss layout
        reels = [
          ["cherry", "lemon", "bell"],
          ["seven", "diamond", "scatter"],
          ["cherry", "lemon", "bell"],
          ["seven", "diamond", "cherry"],
          ["bell", "lemon", "seven"]
        ];
        evalResult = evaluatePaylines(reels);
      } else if (targetSpinType === "NORMAL") {
        // Force normal win (exactly 1 line of 4 cherries = 0.6x multiplier)
        reels = [
          ["lemon", "cherry", "bell"],
          ["seven", "cherry", "scatter"],
          ["lemon", "cherry", "bell"],
          ["seven", "cherry", "cherry"],
          ["bell", "lemon", "seven"]
        ];
        evalResult = evaluatePaylines(reels);
      } else if (targetSpinType === "BONUS") {
        // Force 3 scatters layout to trigger bonus free spins
        reels = [
          ["scatter", "cherry", "bell"],
          ["seven", "scatter", "lemon"],
          ["bell", "lemon", "scatter"],
          ["cherry", "diamond", "cherry"],
          ["bell", "lemon", "seven"]
        ];
        evalResult = evaluatePaylines(reels);
      } else if (targetSpinType === "BIG") {
        const targetMult = Math.floor(Math.random() * 13) + 8; // 8x to 20x
        evalResult = {
          paylines: [
            {
              lineIndex: 0,
              symbols: ["seven", "seven", "seven", "seven", "bell"],
              payout: targetMult
            }
          ],
          totalMultiplier: targetMult,
          isJackpot: false
        };
        reels = [
          ["lemon", "seven", "bell"],
          ["cherry", "seven", "scatter"],
          ["lemon", "seven", "bell"],
          ["seven", "seven", "cherry"],
          ["bell", "lemon", "seven"]
        ];
      } else if (targetSpinType === "MASSIVE") {
        const targetMult = Math.floor(Math.random() * (100 - 30 + 1)) + 30; // 30x to 100x
        evalResult = {
          paylines: [
            {
              lineIndex: 0,
              symbols: ["diamond", "diamond", "diamond", "diamond", "bell"],
              payout: targetMult
            }
          ],
          totalMultiplier: targetMult,
          isJackpot: true
        };
        reels = [
          ["lemon", "diamond", "bell"],
          ["cherry", "diamond", "scatter"],
          ["lemon", "diamond", "bell"],
          ["diamond", "diamond", "cherry"],
          ["bell", "lemon", "seven"]
        ];
      }
    }
  }

  const { paylines, totalMultiplier, isJackpot } = evalResult;

  const totalWin = Math.round(betAmount * totalMultiplier);
  const profit = totalWin - betAmount;

  // Save spin record
  const spin = await SlotSpin.create({
    userId,
    betAmount,
    reels,
    paylines,
    totalWin,
    profit,
    isJackpot,
    multiplier: totalMultiplier,
    seedHash,
    deviceFingerprint,
    ipAddress: ip
  });

  // Update Mongoose triggers if applicable
  if (isNearBankruptcySaver) {
    await User.findByIdAndUpdate(userId, { bankruptcyRecoveryTriggered: true });
  }
  if (isNewUserRewardSpin) {
    await User.findByIdAndUpdate(userId, { newUserRewardTriggered: true });
  }

  // Debit bet
  await debitForBet(userId, betAmount, String(spin._id));

  // Credit winnings if any
  if (totalWin > 0) {
    await creditWinnings(userId, totalWin, String(spin._id));
  }

  // Sync to Firestore for mobile app and ledger compatibility
  try {
    const user = await User.findById(userId).select("firebaseUid");
    if (user?.firebaseUid) {
      await createFirestoreBet(user.firebaseUid, {
        period: `slots_${spin._id}`,
        selection: "SLOTS",
        amount: betAmount,
        status: totalWin > 0 ? "Won" : "Lost",
        profit: totalWin
      });

      await createFirestoreTransaction(user.firebaseUid, {
        type: "SLOTS_BET",
        amount: -betAmount,
        status: "SUCCESS"
      });

      if (totalWin > 0) {
        await createFirestoreTransaction(user.firebaseUid, {
          type: "SLOTS_WIN",
          amount: totalWin,
          status: "SUCCESS"
        });
      }
    }
  } catch (error: any) {
    console.warn("Firestore sync in executeSpin failed:", error.message);
  }

  return {
    spinId: spin._id,
    reels,
    paylines,
    totalWin,
    profit,
    isJackpot,
    multiplier: totalMultiplier,
    betAmount
  };
}

export { PAYLINES };
