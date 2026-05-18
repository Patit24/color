import crypto from "node:crypto";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import { Bet } from "../models/Bet.js";
import { Round } from "../models/Round.js";
import { creditWinnings } from "./walletService.js";

type GameMode = "30S" | "1M" | "3M" | "5M";
type WheelColor = "RED" | "GREEN" | "VIOLET";

const durations: Record<GameMode, number> = {
  "30S": 30,
  "1M": 60,
  "3M": 180,
  "5M": 300
};

function colorFor(number: number): WheelColor {
  if (number === 0) return "RED";
  if (number === 5) return "GREEN";
  return number % 2 === 0 ? "RED" : "GREEN";
}

function colorsFor(number: number): WheelColor[] {
  if (number === 0) return ["RED", "VIOLET"];
  if (number === 5) return ["GREEN", "VIOLET"];
  return [colorFor(number)];
}

function sizeFor(number: number) {
  return number >= 5 ? "BIG" : "SMALL";
}

function resultFromSeed(seed: string, period: string) {
  const hash = crypto.createHash("sha256").update(`${seed}:${period}`).digest("hex");
  return Number.parseInt(hash.slice(0, 8), 16) % 10;
}

function wins(bet: { targetType: string; targetValue: string }, number: number) {
  if (bet.targetType === "NUMBER") return bet.targetValue === String(number);
  if (bet.targetType === "COLOR") return colorsFor(number).some((color) => color === bet.targetValue);
  return bet.targetValue === sizeFor(number);
}

function oddsFor(bet: { targetType: string; targetValue: string }, resultNumber: number) {
  if (bet.targetType === "NUMBER") return 9;
  if (bet.targetType === "SIZE") return 1.5; // Big / Small pays 1.5x (user bet price 10 wins 15)
  if (bet.targetValue === "VIOLET") return 4.5;
  // If targetValue is RED or GREEN, but the result includes VIOLET too (i.e. number is 0 or 5):
  if (resultNumber === 0 || resultNumber === 5) return 1.5; // Half-win payout
  return 3; // Perfect color with exact number takes 3x (win is 3x times of actual bet price)
}

export class GameEngine {
  private timers = new Map<GameMode, NodeJS.Timeout>();

  constructor(private io: Server) {}

  start() {
    (Object.keys(durations) as GameMode[]).forEach((mode) => this.scheduleRound(mode));
  }

  stop() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  private async scheduleRound(gameMode: GameMode) {
    const seed = crypto.randomBytes(32).toString("hex");
    const seedHash = crypto.createHash("sha256").update(seed).digest("hex");
    const period = `${gameMode}-${Date.now()}-${nanoid(6)}`;
    const duration = durations[gameMode];

    const round = await Round.create({
      gameMode,
      period,
      status: "OPEN",
      seedHash,
      bettingOpenedAt: new Date()
    });

    const room = `game:${gameMode}`;
    this.io.to(room).emit("round_started", {
      gameMode,
      period,
      roundId: round._id,
      seedHash,
      duration
    });

    let remaining = duration;
    const interval = setInterval(async () => {
      remaining -= 1;
      this.io.to(room).emit("countdown_update", { gameMode, period, remaining });

      if (remaining === 5) {
        await Round.updateOne({ _id: round._id }, { status: "LOCKED", bettingLockedAt: new Date() });
        this.io.to(room).emit("betting_locked", { gameMode, period });
      }

      if (remaining <= 0) {
        clearInterval(interval);
        await this.settleRound(String(round._id), seed, room);
        this.timers.set(gameMode, setTimeout(() => this.scheduleRound(gameMode), 1000));
      }
    }, 1000);
  }

  private async settleRound(roundId: string, seed: string, room: string) {
    const round = await Round.findById(roundId);
    if (!round) return;

    const resultNumber = resultFromSeed(seed, round.period);
    const resultColor = colorFor(resultNumber);
    const resultColors = colorsFor(resultNumber);
    const resultSize = sizeFor(resultNumber);
    const bets = await Bet.find({ roundId: round._id, status: "PENDING" });
    let totalStake = 0;
    let totalPayout = 0;

    for (const bet of bets) {
      totalStake += bet.amount;
      const won = wins(bet, resultNumber);
      const exactOdds = oddsFor(bet, resultNumber);
      const payout = won ? Math.round(bet.amount * exactOdds) : 0;
      totalPayout += payout;
      bet.status = won ? "WON" : "LOST";
      bet.odds = exactOdds; // Update stored odds to show actual payout multiplier
      bet.payout = payout;
      bet.profit = won ? payout - bet.amount : -bet.amount;
      await bet.save();
      if (won) await creditWinnings(String(bet.userId), payout, String(bet._id));
    }

    round.status = "SETTLED";
    round.revealedSeed = seed;
    round.resultNumber = resultNumber;
    round.resultColor = resultColor;
    round.resultColors = resultColors;
    round.resultSize = resultSize;
    round.totalStake = totalStake;
    round.totalPayout = totalPayout;
    round.settledAt = new Date();
    await round.save();

    this.io.to(room).emit("result_declared", {
      period: round.period,
      resultNumber,
      resultColor,
      resultColors,
      resultSize,
      seed,
      seedHash: round.seedHash
    });
  }
}
