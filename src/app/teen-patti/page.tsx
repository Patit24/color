"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Users, Zap, Trophy, Star, Coins } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getStoredToken } from "@/lib/api-client";

type Mode = "Classic" | "Joker" | "Muflis" | "AK47";
type Card = { suit: "♠" | "♥" | "♦" | "♣"; value: string; color: string };
type HandRank = "Trail" | "Pure Sequence" | "Sequence" | "Color" | "Pair" | "High Card";

const MODES: Mode[] = ["Classic", "Joker", "Muflis", "AK47"];

const SUITS: Card["suit"][] = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const HAND_RANKS: HandRank[] = ["Trail", "Pure Sequence", "Sequence", "Color", "Pair", "High Card"];
const HAND_PAYOUTS: Record<HandRank, number> = {
  Trail: 30,
  "Pure Sequence": 15,
  Sequence: 6,
  Color: 3,
  Pair: 2,
  "High Card": 0,
};

const EMOJIS = ["👑", "🔥", "💎", "🎭", "⚡", "🌙"];

function randomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const value = VALUES[Math.floor(Math.random() * 13)];
  const color = suit === "♥" || suit === "♦" ? "text-red-400" : "text-white";
  return { suit, value, color };
}

function evaluateHand(cards: Card[]): HandRank {
  const r = Math.random();
  if (r < 0.005) return "Trail";
  if (r < 0.02) return "Pure Sequence";
  if (r < 0.07) return "Sequence";
  if (r < 0.18) return "Color";
  if (r < 0.42) return "Pair";
  return "High Card";
}

const BOTS = [
  { name: "Raj_Pro", avatar: "👤", chips: 4200 },
  { name: "LuckyKing", avatar: "🤴", chips: 8900 },
  { name: "AceHunter", avatar: "🎭", chips: 2100 },
];

export default function TeenPattiPage() {
  const [mode, setMode] = useState<Mode>("Classic");
  const [betAmount, setBetAmount] = useState(10);
  const [balance, setBalance] = useState(500);
  const [phase, setPhase] = useState<"idle" | "dealing" | "playing" | "reveal" | "result">("idle");
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<HandRank | null>(null);
  const [dealerHand, setDealerHand] = useState<HandRank | null>(null);
  const [result, setResult] = useState<"win" | "loss" | "tie" | null>(null);
  const [profit, setProfit] = useState(0);
  const [pot, setPot] = useState(0);
  const [history, setHistory] = useState<Array<{ hand: HandRank; result: "win" | "loss" | "tie"; profit: number }>>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [botActions, setBotActions] = useState<string[]>(["", "", ""]);

  const deal = useCallback(() => {
    if (balance < betAmount || phase !== "idle") return;
    setBalance((b) => b - betAmount);
    setPot(betAmount * 4); // player + 3 bots
    setPhase("dealing");
    setResult(null);
    setPlayerHand(null);
    setDealerHand(null);
    setShowWin(false);

    // Animate bot actions
    const bActions = BOTS.map(() => (Math.random() > 0.4 ? "Call" : "Raise"));
    setBotActions(bActions);

    setTimeout(() => {
      const pCards = [randomCard(), randomCard(), randomCard()];
      const dCards = [randomCard(), randomCard(), randomCard()];
      setPlayerCards(pCards);
      setDealerCards(dCards);
      setPhase("playing");
    }, 800);
  }, [balance, betAmount, phase]);

  const reveal = useCallback(() => {
    if (phase !== "playing") return;
    setPhase("reveal");

    const pH = evaluateHand(playerCards);
    const dH = evaluateHand(dealerCards);
    setPlayerHand(pH);
    setDealerHand(dH);

    setTimeout(() => {
      const playerRank = HAND_RANKS.indexOf(pH);
      const dealerRank = HAND_RANKS.indexOf(dH);
      let res: "win" | "loss" | "tie";
      let p = 0;

      if (playerRank < dealerRank) {
        res = "win";
        const mult = HAND_PAYOUTS[pH] || 2;
        p = Math.round(betAmount * mult);
        setBalance((b) => b + betAmount + p);
      } else if (dealerRank < playerRank) {
        res = "loss";
        p = -betAmount;
      } else {
        res = "tie";
        p = 0;
        setBalance((b) => b + betAmount);
      }

      setResult(res);
      setProfit(p);
      if (res === "win") setShowWin(true);
      setHistory((h) => [{ hand: pH, result: res, profit: p }, ...h].slice(0, 10));
      setPhase("result");
    }, 1500);
  }, [phase, playerCards, betAmount]);

  const reset = useCallback(() => {
    setPhase("idle");
    setPlayerCards([]);
    setDealerCards([]);
    setResult(null);
    setSelectedEmoji(null);
  }, []);

  return (
    <main className="min-h-screen bg-[#0d0903] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#1a0d00] via-[#3d1f00] to-[#1a0d00] px-4 py-3 shadow-lg border-b border-yellow-500/20">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <Crown size={20} className="text-yellow-400" /> Teen Patti
              </h1>
              <p className="text-[10px] font-bold text-yellow-400/60 uppercase tracking-widest">3 Patti · Real Money</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5">
              <p className="text-[10px] text-yellow-400/60 font-bold">Balance</p>
              <p className="text-sm font-black text-yellow-300">₹{balance.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pb-28 pt-3">
          {/* Mode Selector */}
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-1">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-2xl px-4 py-2 text-xs font-black transition whitespace-nowrap ${
                    mode === m
                      ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/30"
                      : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0d2b1a] via-[#0a1f13] to-[#061209] border border-yellow-500/20 shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(234,179,8,0.06),transparent_60%)]" />

            {/* Bots */}
            <div className="relative p-4 pb-2">
              <div className="flex justify-around">
                {BOTS.map((bot, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="relative w-12 h-14 flex gap-0.5">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="flex-1 rounded bg-gradient-to-br from-yellow-600/40 to-amber-800/40 border border-yellow-500/20" />
                      ))}
                    </div>
                    <p className="text-[9px] font-black text-yellow-400/70">{bot.name}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                      botActions[i] === "Raise" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {phase === "idle" ? "Waiting" : botActions[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pot */}
            <div className="flex justify-center py-2">
              <div className="flex items-center gap-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 px-4 py-1.5">
                <span className="text-lg">🪙</span>
                <span className="text-sm font-black text-yellow-300">Pot: ₹{pot}</span>
              </div>
            </div>

            {/* Player Cards */}
            <div className="relative px-4 pb-4">
              <p className="text-[10px] font-black text-yellow-400/50 uppercase tracking-widest mb-2 text-center">Your Hand</p>
              <div className="flex justify-center gap-3">
                {phase === "idle" || phase === "dealing" ? (
                  [0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={phase === "dealing" ? { rotateY: [0, 180, 0] } : {}}
                      transition={{ duration: 0.4, delay: i * 0.15 }}
                      className="w-16 h-24 rounded-xl bg-gradient-to-br from-yellow-600/30 to-amber-900/30 border-2 border-yellow-500/20 flex items-center justify-center"
                    >
                      <span className="text-2xl opacity-30">🂠</span>
                    </motion.div>
                  ))
                ) : (
                  playerCards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: -30, opacity: 0, rotateY: 180 }}
                      animate={{ y: 0, opacity: 1, rotateY: 0 }}
                      transition={{ delay: i * 0.12, type: "spring" }}
                      className="w-16 h-24 rounded-xl bg-gradient-to-br from-white to-gray-100 border-2 border-yellow-400 shadow-xl shadow-yellow-500/20 flex flex-col items-center justify-center"
                    >
                      <span className={`text-lg font-black ${card.color}`}>{card.value}</span>
                      <span className={`text-2xl ${card.color}`}>{card.suit}</span>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Hand rank display */}
              <AnimatePresence>
                {playerHand && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-center"
                  >
                    <span className="rounded-full bg-yellow-500/20 border border-yellow-500/30 px-4 py-1.5 text-sm font-black text-yellow-300">
                      {playerHand}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Result Banner */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={`rounded-[24px] p-4 text-center shadow-xl ${
                  result === "win"
                    ? "bg-gradient-to-r from-emerald-900/80 to-green-800/80 border border-emerald-500/30"
                    : result === "loss"
                    ? "bg-gradient-to-r from-red-900/80 to-rose-800/80 border border-red-500/30"
                    : "bg-gradient-to-r from-yellow-900/80 to-amber-800/80 border border-yellow-500/30"
                }`}
              >
                <p className="text-4xl mb-1">{result === "win" ? "🎉" : result === "loss" ? "😔" : "🤝"}</p>
                <p className="text-2xl font-black">{result === "win" ? "YOU WIN!" : result === "loss" ? "YOU LOSE" : "TIE!"}</p>
                {result !== "tie" && (
                  <p className={`text-lg font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {profit >= 0 ? "+" : ""}₹{Math.abs(profit).toLocaleString("en-IN")}
                  </p>
                )}
                <p className="text-xs text-white/50 mt-1">Dealer: {dealerHand}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Emoji Reactions */}
          <div className="flex justify-center gap-3">
            {EMOJIS.map((e) => (
              <motion.button
                key={e}
                whileTap={{ scale: 1.4 }}
                onClick={() => setSelectedEmoji(e)}
                className={`text-2xl rounded-full p-2 transition ${
                  selectedEmoji === e ? "bg-yellow-500/30 ring-2 ring-yellow-400" : "bg-white/5"
                }`}
              >
                {e}
              </motion.button>
            ))}
          </div>

          {/* Bet Controls */}
          <section className="rounded-[24px] bg-[#1a0d00] border border-yellow-500/20 p-4 space-y-4">
            <div>
              <p className="text-xs font-black text-yellow-400/60 uppercase tracking-widest mb-2">Bet Amount (₹)</p>
              <div className="flex gap-2 flex-wrap">
                {[5, 10, 25, 50, 100, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                      betAmount === v
                        ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg"
                        : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    }`}
                  >
                    ₹{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {phase === "idle" ? (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={deal}
                  disabled={balance < betAmount}
                  className="col-span-2 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 py-4 text-lg font-black text-black shadow-xl shadow-yellow-500/30 disabled:opacity-50"
                >
                  <Crown size={20} className="inline mr-2" />
                  Deal Cards · ₹{betAmount}
                </motion.button>
              ) : phase === "playing" ? (
                <>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={reveal}
                    className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-500/30"
                  >
                    Show Hand
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setBalance((b) => b); // fold - lose bet
                      setResult("loss");
                      setProfit(-betAmount);
                      setHistory((h) => [{ hand: "High Card", result: "loss", profit: -betAmount }, ...h].slice(0, 10));
                      setPhase("result");
                    }}
                    className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 py-4 text-sm font-black text-white shadow-xl shadow-red-500/30"
                  >
                    Fold
                  </motion.button>
                </>
              ) : phase === "result" ? (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={reset}
                  className="col-span-2 rounded-2xl bg-gradient-to-r from-yellow-600 to-amber-700 py-4 text-lg font-black text-black shadow-xl shadow-yellow-500/30"
                >
                  New Game
                </motion.button>
              ) : (
                <div className="col-span-2 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 py-4 text-center text-yellow-400/50 font-black animate-pulse">
                  Dealing cards...
                </div>
              )}
            </div>
          </section>

          {/* History */}
          {history.length > 0 && (
            <section className="rounded-[24px] bg-[#0d0903] border border-yellow-500/10 p-4">
              <h2 className="text-sm font-black text-yellow-400/60 mb-3 uppercase tracking-widest">Recent Hands</h2>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-xs font-bold text-white/60">{h.hand}</span>
                    <span className={`text-xs font-black ${h.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {h.profit >= 0 ? "+" : ""}₹{Math.abs(h.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-yellow-500/10 bg-[#0d0903]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🏠", label: "Home", href: "/" },
              { icon: "🃏", label: "Teen Patti", href: "/teen-patti" },
              { icon: "🎰", label: "Andar Bahar", href: "/andar-bahar" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
                  item.href === "/teen-patti" ? "bg-yellow-500/20 text-yellow-400" : "text-white/40"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Big Win Popup */}
        <AnimatePresence>
          {showWin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              onClick={() => setShowWin(false)}
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-center"
              >
                <p className="text-8xl">🏆</p>
                <p className="text-5xl font-black text-yellow-300 mt-2">BIG WIN!</p>
                <p className="text-3xl font-black text-white mt-1">+₹{profit.toLocaleString("en-IN")}</p>
                <p className="text-white/40 mt-4 text-sm">Tap to continue</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
