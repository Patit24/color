"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, RotateCcw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState, useCallback, useRef } from "react";

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const HOT_SIDES = ["Andar", "Bahar"] as const;
type Side = typeof HOT_SIDES[number];

interface Card {
  suit: typeof SUITS[number];
  value: string;
  isRed: boolean;
}

function randomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const value = VALUES[Math.floor(Math.random() * 13)];
  return { suit, value, isRed: suit === "♥" || suit === "♦" };
}

function CardDisplay({ card, hidden = false, small = false }: { card?: Card; hidden?: boolean; small?: boolean }) {
  if (hidden || !card) {
    return (
      <div className={`${small ? "w-9 h-12" : "w-14 h-20"} rounded-lg bg-gradient-to-br from-indigo-800/60 to-purple-900/60 border border-indigo-500/30 flex items-center justify-center`}>
        <span className={`${small ? "text-base" : "text-2xl"} opacity-30`}>🂠</span>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ rotateY: 90, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      className={`${small ? "w-9 h-12" : "w-14 h-20"} rounded-lg bg-white border-2 ${card.isRed ? "border-red-400" : "border-slate-700"} flex flex-col items-center justify-center shadow-lg`}
    >
      <span className={`${small ? "text-[10px]" : "text-sm"} font-black ${card.isRed ? "text-red-500" : "text-slate-800"}`}>{card.value}</span>
      <span className={`${small ? "text-sm" : "text-xl"} ${card.isRed ? "text-red-500" : "text-slate-800"}`}>{card.suit}</span>
    </motion.div>
  );
}

export default function AndarBaharPage() {
  const [balance, setBalance] = useState(500);
  const [betAmount, setBetAmount] = useState(10);
  const [selectedSide, setSelectedSide] = useState<Side | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "result">("idle");
  const [jokerCard, setJokerCard] = useState<Card | null>(null);
  const [andarCards, setAndarCards] = useState<Card[]>([]);
  const [baharCards, setBaharCards] = useState<Card[]>([]);
  const [winSide, setWinSide] = useState<Side | null>(null);
  const [result, setResult] = useState<"win" | "loss" | null>(null);
  const [profit, setProfit] = useState(0);
  const [history, setHistory] = useState<Array<{ side: Side; result: "win" | "loss"; profit: number }>>([]);
  const [autoBet, setAutoBet] = useState(false);
  const [hotStreaks, setHotStreaks] = useState({ Andar: 0, Bahar: 0 });
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = useCallback(() => {
    if (!selectedSide || balance < betAmount || phase !== "idle") return;
    setBalance((b) => b - betAmount);
    setPhase("running");
    setResult(null);
    setAndarCards([]);
    setBaharCards([]);

    const jk = randomCard();
    setJokerCard(jk);

    let andar: Card[] = [];
    let bahar: Card[] = [];
    let turn = 0;

    const runTick = () => {
      const c = randomCard();
      setCurrentCard(c);

      if (turn % 2 === 0) {
        andar = [...andar, c];
        setAndarCards([...andar]);
      } else {
        bahar = [...bahar, c];
        setBaharCards([...bahar]);
      }
      turn++;

      // Match found?
      const matched = c.value === jk.value;
      if (matched || turn > 24) {
        clearInterval(intervalRef.current!);
        const ws: Side = turn % 2 === 1 ? "Andar" : "Bahar";
        setWinSide(ws);
        const won = ws === selectedSide;
        const p = won ? betAmount : -betAmount;
        setResult(won ? "win" : "loss");
        setProfit(p);
        if (won) setBalance((b) => b + betAmount * 2);
        setHistory((h) => [{ side: selectedSide!, result: won ? "win" : "loss", profit: p }, ...h].slice(0, 10));
        setHotStreaks((prev) => ({ ...prev, [ws]: prev[ws] + 1 }));
        setPhase("result");
      }
    };

    intervalRef.current = setInterval(runTick, 400);
  }, [selectedSide, balance, betAmount, phase]);

  const reset = useCallback(() => {
    setPhase("idle");
    setJokerCard(null);
    setWinSide(null);
    setResult(null);
    setCurrentCard(null);
  }, []);

  return (
    <main className="min-h-screen bg-[#060412] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#0d0825] via-[#1a1045] to-[#0d0825] px-4 py-3 shadow-lg border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <span className="text-xl">🃏</span> Andar Bahar
              </h1>
              <p className="text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">Ultra-Fast · Live Cards</p>
            </div>
          </div>
          <div className="rounded-xl bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-right">
            <p className="text-[10px] text-purple-400/60 font-bold">Balance</p>
            <p className="text-sm font-black text-purple-300">₹{balance.toLocaleString("en-IN")}</p>
          </div>
        </header>

        <div className="space-y-4 px-3 pb-28 pt-3">
          {/* Hot/Cold Trends */}
          <div className="grid grid-cols-2 gap-2">
            {HOT_SIDES.map((side) => (
              <div key={side} className={`rounded-2xl p-3 text-center ${side === "Andar" ? "bg-red-500/10 border border-red-500/20" : "bg-blue-500/10 border border-blue-500/20"}`}>
                <p className={`text-xs font-black uppercase tracking-widest ${side === "Andar" ? "text-red-400" : "text-blue-400"}`}>{side}</p>
                <p className="text-2xl font-black mt-1">{hotStreaks[side]}🔥</p>
                <p className="text-[10px] text-white/30 mt-1">Streak</p>
              </div>
            ))}
          </div>

          {/* Main Game Board */}
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0d0825] to-[#060412] border border-purple-500/20 p-4 shadow-2xl">
            {/* Joker Card */}
            <div className="flex justify-center mb-4">
              <div className="text-center">
                <p className="text-[10px] font-black text-purple-400/60 uppercase tracking-widest mb-2">Joker Card</p>
                {jokerCard ? (
                  <motion.div
                    initial={{ scale: 0, rotate: 360 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="mx-auto w-16 h-22 relative"
                  >
                    <CardDisplay card={jokerCard} />
                    <div className="absolute -top-2 -right-2 rounded-full bg-yellow-400 text-black text-[10px] font-black px-1.5 py-0.5">JOKER</div>
                  </motion.div>
                ) : (
                  <CardDisplay hidden />
                )}
              </div>
            </div>

            {/* Two sides */}
            <div className="grid grid-cols-2 gap-3">
              {/* Andar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-red-400 uppercase tracking-widest">Andar</p>
                  <span className="text-[10px] text-red-400/50">{andarCards.length} cards</span>
                </div>
                <div className="min-h-[80px] flex flex-wrap gap-1 p-2 rounded-xl bg-red-500/5 border border-red-500/10">
                  {andarCards.slice(-6).map((c, i) => (
                    <CardDisplay key={i} card={c} small />
                  ))}
                </div>
              </div>
              {/* Bahar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Bahar</p>
                  <span className="text-[10px] text-blue-400/50">{baharCards.length} cards</span>
                </div>
                <div className="min-h-[80px] flex flex-wrap gap-1 p-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  {baharCards.slice(-6).map((c, i) => (
                    <CardDisplay key={i} card={c} small />
                  ))}
                </div>
              </div>
            </div>

            {/* Running indicator */}
            {phase === "running" && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"
                />
                <span className="text-xs font-bold text-purple-400">Drawing cards...</span>
              </div>
            )}
          </section>

          {/* Result */}
          <AnimatePresence>
            {result && winSide && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={`rounded-[24px] p-4 text-center ${
                  result === "win"
                    ? "bg-gradient-to-r from-emerald-900/80 to-green-800/80 border border-emerald-500/30"
                    : "bg-gradient-to-r from-red-900/80 to-rose-800/80 border border-red-500/30"
                }`}
              >
                <p className="text-4xl mb-1">{result === "win" ? "🎉" : "😔"}</p>
                <p className="text-2xl font-black">{result === "win" ? "YOU WIN!" : "YOU LOSE"}</p>
                <p className={`text-lg font-black ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {profit >= 0 ? "+" : ""}₹{Math.abs(profit)}
                </p>
                <p className="text-xs text-white/50 mt-1">Landed on {winSide}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Side Selection */}
          <div className="grid grid-cols-2 gap-3">
            {HOT_SIDES.map((side) => (
              <motion.button
                key={side}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedSide(side)}
                disabled={phase !== "idle"}
                className={`rounded-2xl py-5 text-xl font-black transition shadow-xl disabled:opacity-50 ${
                  selectedSide === side
                    ? side === "Andar"
                      ? "bg-gradient-to-br from-red-500 to-rose-600 ring-4 ring-red-300 shadow-red-500/40"
                      : "bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-blue-300 shadow-blue-500/40"
                    : side === "Andar"
                    ? "bg-red-500/10 border border-red-500/30 text-red-400"
                    : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                }`}
              >
                {side}
              </motion.button>
            ))}
          </div>

          {/* Bet Amount */}
          <div className="rounded-[24px] bg-[#0d0825] border border-purple-500/20 p-4">
            <p className="text-xs font-black text-purple-400/60 uppercase tracking-widest mb-2">Bet Amount (₹)</p>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 25, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setBetAmount(v)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    betAmount === v
                      ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg"
                      : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  }`}
                >
                  ₹{v}
                </button>
              ))}
            </div>

            {/* Auto-bet toggle */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs font-bold text-white/50">Auto Repeat Bet</span>
              <button
                onClick={() => setAutoBet(!autoBet)}
                className={`relative w-10 h-5 rounded-full transition-colors ${autoBet ? "bg-purple-500" : "bg-white/10"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoBet ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          {/* Deal / Reset Button */}
          {phase === "idle" ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startGame}
              disabled={!selectedSide || balance < betAmount}
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 py-4 text-lg font-black text-white shadow-xl shadow-purple-500/30 disabled:opacity-50"
            >
              <Zap size={20} className="inline mr-2" />
              {selectedSide ? `Bet on ${selectedSide} · ₹${betAmount}` : "Select Andar or Bahar"}
            </motion.button>
          ) : phase === "result" ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={reset}
              className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-4 text-lg font-black text-white shadow-xl"
            >
              <RotateCcw size={20} className="inline mr-2" />
              Play Again
            </motion.button>
          ) : (
            <div className="w-full rounded-2xl bg-purple-500/10 border border-purple-500/20 py-4 text-center text-purple-400/50 font-black animate-pulse">
              Game in progress...
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <section className="rounded-[24px] bg-[#0d0825] border border-purple-500/10 p-4">
              <h2 className="text-sm font-black text-purple-400/60 mb-3 uppercase tracking-widest">Recent Rounds</h2>
              <div className="flex gap-2 flex-wrap">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      h.result === "win" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {h.side} {h.result === "win" ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-purple-500/10 bg-[#060412]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🏠", label: "Home", href: "/" },
              { icon: "👑", label: "Teen Patti", href: "/teen-patti" },
              { icon: "🃏", label: "Andar Bahar", href: "/andar-bahar" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
                  item.href === "/andar-bahar" ? "bg-purple-500/20 text-purple-400" : "text-white/40"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}
