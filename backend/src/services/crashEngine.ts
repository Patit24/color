import crypto from "node:crypto";
import { Server } from "socket.io";
import { CrashRound } from "../models/CrashRound.js";
import { CrashBet } from "../models/CrashBet.js";
import { creditWinnings, debitForBet } from "./walletService.js";
import { User } from "../models/User.js";
import { createFirestoreTransaction, createFirestoreBet, updateFirestoreBet } from "./firebase.js";

const BETTING_WINDOW_MS = 30_000; // 30 seconds
const TICK_INTERVAL_MS = 100; // 100ms ticks
const GROWTH_RATE = 0.00006; // multiplier growth per tick
const HOUSE_EDGE = 0.03; // 3% house edge

function generateCrashPoint(seed: string): number {
  const hash = crypto.createHmac("sha256", seed).update("crash").digest("hex");
  const h = parseInt(hash.slice(0, 13), 16);
  const maxH = Math.pow(2, 52);
  const u = h / maxH; // u is a uniform random float in [0, 1)

  let point = 1.00;
  if (u < 0.73) {
    // 73% under 2x (shifted 7% out to favor 2x-4x)
    point = 1.00 + (u / 0.73) * 1.00; // range [1.00, 2.00)
  } else if (u < 0.80) {
    // 7% dedicated boost specifically for the 2x to 4x range
    point = 2.00 + ((u - 0.73) / 0.07) * 2.00; // range [2.00, 4.00)
  } else if (u < 0.917) {
    // 11.7% between 2x and 5x
    point = 2.00 + ((u - 0.80) / 0.117) * 3.00; // range [2.00, 5.00)
  } else if (u < 0.947) {
    // 3% between 5x and 10x
    point = 5.00 + ((u - 0.917) / 0.03) * 5.00; // range [5.00, 10.00)
  } else if (u < 0.977) {
    // 3% between 10x and 20x
    point = 10.00 + ((u - 0.947) / 0.03) * 10.00; // range [10.00, 20.00)
  } else if (u < 0.997) {
    // 2% between 20x and 100x
    point = 20.00 + ((u - 0.977) / 0.02) * 80.00; // range [20.00, 100.00)
  } else {
    // 0.3% (max 3 rounds in 1000) will reach the 100x+ multiplier (range 100.00 to 250.00)
    point = 100.00 + ((u - 0.997) / 0.003) * 150.00;
  }

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
  private currentPhase: "BETTING" | "RUNNING" | "CRASHED" | "WAITING" = "WAITING";
  private currentRoundNumber = 0;
  private bettingCountdown = 0;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  public async start() {
    if (this.running) return;
    this.running = true;
    this.runRoundLoop();
  }

  public stop() {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private async runRoundLoop() {
    while (this.running) {
      try {
        await this.executeRound();
      } catch (err) {
        console.error("Error in crash round execute:", err);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async executeRound() {
    const seed = crypto.randomBytes(32).toString("hex");
    const seedHash = crypto.createHash("sha256").update(seed).digest("hex");
    const crashPoint = generateCrashPoint(seed);
    const roundNumber = await getNextRoundNumber();

    const round = await CrashRound.create({
      roundNumber,
      seedHash,
      crashPoint,
      status: "BETTING"
    });

    this.currentRoundId = String(round._id);
    this.currentRoundNumber = roundNumber;
    this.currentPhase = "BETTING";
    this.currentMultiplier = 1.0;

    this.io.to("crash").emit("crash:round_start", {
      roundNumber,
      bettingWindowMs: BETTING_WINDOW_MS
    });

    let countdownSeconds = BETTING_WINDOW_MS / 1000;
    this.bettingCountdown = countdownSeconds;
    const countdownInterval = setInterval(() => {
      countdownSeconds--;
      this.bettingCountdown = countdownSeconds;
      this.io.to("crash").emit("crash:betting_countdown", { seconds: countdownSeconds });
      if (countdownSeconds <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    await new Promise((resolve) => setTimeout(resolve, BETTING_WINDOW_MS));
    clearInterval(countdownInterval);

    await CrashRound.updateOne({ _id: round._id }, { status: "RUNNING", startedAt: new Date() });
    this.currentPhase = "RUNNING";

    const startTime = Date.now();
    this.io.to("crash").emit("crash:running", { roundNumber, startedAt: startTime });

    this.tickTimer = setInterval(async () => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      this.currentMultiplier = Math.round(Math.pow(Math.E, 0.15 * elapsedSec) * 100) / 100;

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

    // Wait until crashed
    await new Promise<void>((resolve) => {
      const checkCrashed = setInterval(() => {
        if (this.currentPhase === "CRASHED") {
          clearInterval(checkCrashed);
          resolve();
        }
      }, 100);
    });

    // 5 seconds buffer before next round
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  private async processCashout(bet: any, atMultiplier: number) {
    const payout = Math.round(bet.amount * atMultiplier);
    bet.status = "CASHED_OUT";
    bet.cashedOutAt = atMultiplier;
    bet.payout = payout;
    bet.profit = payout - bet.amount;
    await bet.save();
    await creditWinnings(String(bet.userId), payout, String(bet._id));

    // Sync cashout/win to Firestore
    try {
      const user = await User.findById(bet.userId).select("firebaseUid");
      if (user?.firebaseUid) {
        await updateFirestoreBet(user.firebaseUid, `crash_${bet.roundNumber}`, {
          status: "Won",
          profit: payout
        });

        await createFirestoreTransaction(user.firebaseUid, {
          type: "CRASH_WIN",
          amount: payout,
          status: "SUCCESS"
        });
      }
    } catch (error: any) {
      console.warn("Firestore sync in crash processCashout failed:", error.message);
    }

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
    this.currentPhase = "CRASHED";
    // Bust all remaining active bets
    const bustedBets = await CrashBet.find({ roundId, status: "ACTIVE" });
    for (const bet of bustedBets) {
      bet.status = "BUSTED";
      bet.payout = 0;
      bet.profit = -bet.amount;
      await bet.save();

      // Sync loss status to Firestore
      try {
        const user = await User.findById(bet.userId).select("firebaseUid");
        if (user?.firebaseUid) {
          await updateFirestoreBet(user.firebaseUid, `crash_${roundNumber}`, {
            status: "Lost",
            profit: 0
          });
        }
      } catch (error: any) {
        console.warn("Firestore sync in crash settleCrash failed:", error.message);
      }
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
  }

  async placeBet(userId: string, amount: number, autoCashout: number, deviceFingerprint: string, ip: string) {
    if (typeof amount !== "number" || isNaN(amount) || amount < 2 || amount > 10000) {
      throw new Error("Invalid bet amount. Must be between ₹2 and ₹10,000");
    }
    if (!Number.isInteger(amount)) {
      throw new Error("Bet amount must be a whole number");
    }
    if (autoCashout !== undefined && autoCashout !== null && autoCashout !== 0) {
      if (typeof autoCashout !== "number" || isNaN(autoCashout) || autoCashout < 1.01 || autoCashout > 1000) {
        throw new Error("Invalid auto cashout multiplier. Must be between 1.01 and 1000");
      }
    }

    if (!this.currentRoundId) throw new Error("No active round");

    const round = await CrashRound.findById(this.currentRoundId);
    if (!round || round.status !== "BETTING") throw new Error("Betting is closed");

    if (this.bettingCountdown <= 5) {
      throw new Error("Betting is locked (starts in less than 5 seconds)");
    }

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

    // Sync to Firestore for mobile app compatibility
    try {
      const user = await User.findById(userId).select("firebaseUid");
      if (user?.firebaseUid) {
        await createFirestoreBet(user.firebaseUid, {
          period: `crash_${round.roundNumber}`,
          selection: "CRASH",
          amount,
          status: "Pending",
          profit: 0
        });

        await createFirestoreTransaction(user.firebaseUid, {
          type: "CRASH_BET",
          amount: -amount,
          status: "SUCCESS"
        });
      }
    } catch (error: any) {
      console.warn("Firestore sync in crash placeBet failed:", error.message);
    }

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

  async getSyncState(userId?: string) {
    let myBet: any = null;
    if (userId && this.currentRoundId) {
      myBet = await CrashBet.findOne({
        userId,
        roundId: this.currentRoundId
      });
    }

    return {
      phase: this.currentPhase,
      roundNumber: this.currentRoundNumber,
      multiplier: this.currentMultiplier,
      bettingCountdown: this.bettingCountdown,
      myBet: myBet ? {
        amount: myBet.amount,
        autoCashout: myBet.autoCashout,
        status: myBet.status,
        cashedOutAt: myBet.cashedOutAt,
        payout: myBet.payout
      } : null
    };
  }
}
