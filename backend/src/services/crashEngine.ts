import crypto from "node:crypto";
import { Server } from "socket.io";
import { CrashRound } from "../models/CrashRound.js";
import { CrashBet } from "../models/CrashBet.js";
import { creditWinnings, debitForBet } from "./walletService.js";

const BETTING_WINDOW_MS = 10_000; // 10 seconds
const TICK_INTERVAL_MS = 100; // 100ms ticks
const GROWTH_RATE = 0.00006; // multiplier growth per tick
const HOUSE_EDGE = 0.03; // 3% house edge

function generateCrashPoint(seed: string): number {
  const hash = crypto.createHmac("sha256", seed).update("crash").digest("hex");
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  const raw = (100 * e - h) / (e - h);
  const point = Math.max(1.0, Math.floor(raw * (1 - HOUSE_EDGE)) / 100);
  return Math.round(point * 100) / 100;
}

let roundCounter = 0;

async function getNextRoundNumber(): Promise<number> {
  if (roundCounter === 0) {
    const last = await CrashRound.findOne().sort({ roundNumber: -1 });
    roundCounter = last ? last.roundNumber : 0;
  }
  roundCounter++;
  return roundCounter;
}

export class CrashEngine {
  private running = false;
  private currentMultiplier = 1.0;
  private tickTimer: NodeJS.Timeout | null = null;
  private currentRoundId: string | null = null;

  constructor(private io: Server) {}

  start() {
    this.running = true;
    this.scheduleRound();
  }

  stop() {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  private async scheduleRound() {
    if (!this.running) return;

    const seed = crypto.randomBytes(32).toString("hex");
    const seedHash = crypto.createHash("sha256").update(seed).digest("hex");
    const crashPoint = generateCrashPoint(seed);
    const roundNumber = await getNextRoundNumber();

    const round = await CrashRound.create({
      roundNumber,
      status: "BETTING",
      seedHash,
      crashPoint,
      bettingEndsAt: new Date(Date.now() + BETTING_WINDOW_MS)
    });

    this.currentRoundId = String(round._id);
    this.currentMultiplier = 1.0;

    this.io.to("crash").emit("crash:round_start", {
      roundNumber,
      seedHash,
      bettingEndsAt: round.bettingEndsAt,
      bettingWindowMs: BETTING_WINDOW_MS
    });

    // Betting countdown
    let bettingCountdown = BETTING_WINDOW_MS / 1000;
    const countdownInterval = setInterval(() => {
      bettingCountdown--;
      this.io.to("crash").emit("crash:betting_countdown", { seconds: bettingCountdown });
      if (bettingCountdown <= 0) clearInterval(countdownInterval);
    }, 1000);

    // After betting window, start the multiplier
    setTimeout(async () => {
      clearInterval(countdownInterval);
      await CrashRound.updateOne({ _id: round._id }, { status: "RUNNING", startedAt: new Date() });

      this.io.to("crash").emit("crash:running", { roundNumber });

      let elapsed = 0;
      this.tickTimer = setInterval(async () => {
        elapsed++;
        this.currentMultiplier = Math.round((1 + Math.pow(elapsed * GROWTH_RATE * 100, 1.5) / 100) * 100) / 100;

        // Check auto-cashouts
        const autoBets = await CrashBet.find({
          roundId: round._id,
          status: "ACTIVE",
          autoCashout: { $gt: 0, $lte: this.currentMultiplier }
        });

        for (const bet of autoBets) {
          await this.processCashout(bet, bet.autoCashout);
        }

        this.io.to("crash").emit("crash:tick", {
          multiplier: this.currentMultiplier,
          roundNumber
        });

        // CRASH!
        if (this.currentMultiplier >= crashPoint) {
          clearInterval(this.tickTimer!);
          this.tickTimer = null;
          await this.settleCrash(String(round._id), seed, crashPoint, roundNumber);
        }
      }, TICK_INTERVAL_MS);
    }, BETTING_WINDOW_MS);
  }

  private async processCashout(bet: any, atMultiplier: number) {
    const payout = Math.round(bet.amount * atMultiplier);
    bet.status = "CASHED_OUT";
    bet.cashedOutAt = atMultiplier;
    bet.payout = payout;
    bet.profit = payout - bet.amount;
    await bet.save();
    await creditWinnings(String(bet.userId), payout, String(bet._id));

    this.io.to("crash").emit("crash:player_cashout", {
      userId: String(bet.userId),
      multiplier: atMultiplier,
      payout
    });

    // Notify specific user
    this.io.to(`wallet:${bet.userId}`).emit("crash:my_cashout", {
      multiplier: atMultiplier,
      payout,
      profit: bet.profit
    });
  }

  private async settleCrash(roundId: string, seed: string, crashPoint: number, roundNumber: number) {
    // Bust all remaining active bets
    const bustedBets = await CrashBet.find({ roundId, status: "ACTIVE" });
    for (const bet of bustedBets) {
      bet.status = "BUSTED";
      bet.payout = 0;
      bet.profit = -bet.amount;
      await bet.save();
    }

    const allBets = await CrashBet.find({ roundId });
    const totalStake = allBets.reduce((s, b) => s + b.amount, 0);
    const totalPayout = allBets.reduce((s, b) => s + b.payout, 0);

    await CrashRound.updateOne(
      { _id: roundId },
      {
        status: "CRASHED",
        revealedSeed: seed,
        crashedAt: new Date(),
        totalStake,
        totalPayout,
        playerCount: allBets.length
      }
    );

    this.io.to("crash").emit("crash:crashed", {
      roundNumber,
      crashPoint,
      seed,
      totalStake,
      totalPayout,
      playerCount: allBets.length
    });

    // Auto-start next round after 3 seconds
    setTimeout(() => this.scheduleRound(), 3000);
  }

  async placeBet(userId: string, amount: number, autoCashout: number, deviceFingerprint: string, ip: string) {
    if (!this.currentRoundId) throw new Error("No active round");

    const round = await CrashRound.findById(this.currentRoundId);
    if (!round || round.status !== "BETTING") throw new Error("Betting is closed");

    // Check if user already bet this round
    const existing = await CrashBet.findOne({ userId, roundId: round._id });
    if (existing) throw new Error("Already placed a bet this round");

    const bet = await CrashBet.create({
      userId,
      roundId: round._id,
      roundNumber: round.roundNumber,
      amount,
      autoCashout: autoCashout || 0,
      deviceFingerprint,
      ipAddress: ip
    });

    await debitForBet(userId, amount, String(bet._id));

    this.io.to("crash").emit("crash:new_bet", {
      roundNumber: round.roundNumber,
      amount,
      hasAutoCashout: autoCashout > 0
    });

    return bet;
  }

  async cashout(userId: string) {
    if (!this.currentRoundId) throw new Error("No active round");

    const bet = await CrashBet.findOne({
      userId,
      roundId: this.currentRoundId,
      status: "ACTIVE"
    });

    if (!bet) throw new Error("No active bet to cash out");

    await this.processCashout(bet, this.currentMultiplier);
    return { multiplier: this.currentMultiplier, payout: bet.payout };
  }

  getCurrentState() {
    return {
      roundId: this.currentRoundId,
      multiplier: this.currentMultiplier
    };
  }
}
