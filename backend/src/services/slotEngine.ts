import crypto from "node:crypto";
import { SlotSpin } from "../models/SlotSpin.js";
import { debitForBet, creditWinnings } from "./walletService.js";

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
  cherry: 2,
  lemon: 3,
  bell: 5,
  seven: 10,
  diamond: 25,
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
    const scatterPayout = scatterCount === 3 ? 5 : scatterCount === 4 ? 15 : 50;
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
  if (betAmount < 10) throw new Error("Minimum bet is ₹10");
  if (betAmount > 10000) throw new Error("Maximum bet is ₹10,000");

  // Debit wallet
  const seed = crypto.randomBytes(32).toString("hex");
  const seedHash = crypto.createHash("sha256").update(seed).digest("hex");

  // Generate reels
  const reels = generateReels(seed);
  const { paylines, totalMultiplier, isJackpot } = evaluatePaylines(reels);

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

  // Debit bet
  await debitForBet(userId, betAmount, String(spin._id));

  // Credit winnings if any
  if (totalWin > 0) {
    await creditWinnings(userId, totalWin, String(spin._id));
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
