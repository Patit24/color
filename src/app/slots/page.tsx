"use client";
export default function SlotsPage() {
  return <SlotMachine />;
}

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Cherry,
  Diamond,
  Star,
  Zap,
  Trophy,
  History,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getStoredToken } from "@/lib/api-client";
import { auth } from "@/lib/firebase";

type SlotSymbol = "cherry" | "lemon" | "bell" | "seven" | "diamond" | "wild" | "scatter";

const SYMBOL_CONFIG: Record<SlotSymbol, { emoji: string; color: string; glow: string }> = {
  cherry: { emoji: "🍒", color: "from-red-500 to-rose-600", glow: "shadow-red-500/40" },
  lemon: { emoji: "🍋", color: "from-yellow-400 to-amber-500", glow: "shadow-yellow-500/40" },
  bell: { emoji: "🔔", color: "from-amber-400 to-orange-500", glow: "shadow-amber-500/40" },
  seven: { emoji: "7️⃣", color: "from-blue-500 to-indigo-600", glow: "shadow-blue-500/40" },
  diamond: { emoji: "💎", color: "from-cyan-400 to-blue-500", glow: "shadow-cyan-500/40" },
  wild: { emoji: "⭐", color: "from-purple-500 to-violet-600", glow: "shadow-purple-500/40" },
  scatter: { emoji: "🌟", color: "from-yellow-300 to-orange-400", glow: "shadow-yellow-400/40" },
};

interface SpinResult {
  reels: SlotSymbol[][];
  paylines: Array<{ lineIndex: number; symbols: SlotSymbol[]; payout: number }>;
  totalWin: number;
  profit: number;
  isJackpot: boolean;
  multiplier: number;
  betAmount: number;
}

interface SpinHistoryItem {
  betAmount: number;
  totalWin: number;
  profit: number;
  isJackpot: boolean;
  multiplier: number;
  createdAt: string;
}

function SlotMachine() {
  const [betAmount, setBetAmount] = useState(2);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[][]>([
    ["cherry", "lemon", "bell"],
    ["seven", "diamond", "cherry"],
    ["bell", "wild", "seven"],
    ["lemon", "cherry", "diamond"],
    ["scatter", "bell", "lemon"],
  ]);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [history, setHistory] = useState<SpinHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState({ totalSpins: 0, totalBet: 0, totalWon: 0, biggestWin: 0, jackpots: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const { apiRequest } = await import("@/lib/api-client");
          const syncResponse = await apiRequest<{ success: boolean; accessToken?: string }>("/auth/firebase-sync", {
            method: "POST",
            body: JSON.stringify({ idToken })
          });
          if (syncResponse.accessToken) {
            window.localStorage.setItem("accessToken", syncResponse.accessToken);
            console.log("Backend authorization token synced on Slots mount!");
          }
        } catch (e: any) {
          console.warn("Slots mount token sync failed:", e.message);
        }
      }
    });
    return () => unsub();
  }, []);

  const spin = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return alert("Please login first");
    if (spinning) return;

    setSpinning(true);
    setResult(null);
    setShowWin(false);

    // Animate reels with random symbols during spin
    const spinInterval = setInterval(() => {
      const symbols: SlotSymbol[] = ["cherry", "lemon", "bell", "seven", "diamond", "wild", "scatter"];
      setReels(
        Array.from({ length: 5 }, () =>
          Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)])
        )
      );
    }, 80);

    try {
      const data = await apiRequest<SpinResult>("/slots/spin", {
        method: "POST",
        body: JSON.stringify({ amount: betAmount }),
        token,
      });

      // Stop spinning after staggered delays per reel
      setTimeout(() => {
        clearInterval(spinInterval);
        setReels(data.reels);
        setResult(data);
        setSpinning(false);

        if (data.totalWin > 0) {
          setTimeout(() => setShowWin(true), 400);
        }

        // Update history
        setHistory((prev) => [
          {
            betAmount: data.betAmount,
            totalWin: data.totalWin,
            profit: data.profit,
            isJackpot: data.isJackpot,
            multiplier: data.multiplier,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      }, 1000);
    } catch (err: any) {
      clearInterval(spinInterval);
      setSpinning(false);
      alert(err.message || "Spin failed");
    }
  }, [betAmount, spinning]);

  const loadHistory = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const [histData, statsData] = await Promise.all([
        apiRequest<{ spins: SpinHistoryItem[] }>("/slots/history", { token }),
        apiRequest<{ stats: typeof stats }>("/slots/stats", { token }),
      ]);
      setHistory(histData.spins);
      setStats(statsData.stats);
      setShowHistory(true);
    } catch {}
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0610] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[#2d0a4e] via-[#1a0633] to-[#0a0610] px-4 py-3 shadow-lg shadow-purple-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-lg font-black flex items-center gap-2">
                  <span className="text-2xl">🎰</span> Lucky Slots
                </h1>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">5 reels · 20 paylines</p>
              </div>
            </div>
            <button
              onClick={loadHistory}
              className="grid size-9 place-items-center rounded-full bg-white/10"
            >
              <History size={16} />
            </button>
          </div>
        </header>

        <div className="space-y-3 px-3 pb-28 pt-3">
          {/* Slot Machine Frame */}
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#1a0633] via-[#120425] to-[#0a0610] border-2 border-purple-500/20 shadow-2xl shadow-purple-900/30">
            {/* Decorative lights */}
            <div className="absolute top-0 inset-x-0 flex justify-center gap-3 py-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  className="size-2 rounded-full bg-yellow-400"
                />
              ))}
            </div>

            {/* Payline indicator */}
            <div className="relative px-3 pt-8 pb-4">
              {/* Reel Container */}
              <div className="relative rounded-2xl bg-black/60 border border-white/10 p-2 overflow-hidden">
                {/* Center payline indicator */}
                <div className="absolute inset-y-0 left-0 right-0 z-10 pointer-events-none flex items-center">
                  <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-60" style={{ marginTop: "-2px" }} />
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {reels.map((reel, colIdx) => (
                    <div key={colIdx} className="space-y-1.5">
                      {reel.map((symbol, rowIdx) => {
                        const config = SYMBOL_CONFIG[symbol];
                        const isWinning =
                          result?.paylines.some(
                            (p) => p.lineIndex >= 0 && p.payout > 0
                          ) || false;

                        return (
                          <motion.div
                            key={`${colIdx}-${rowIdx}-${symbol}`}
                            initial={spinning ? { y: -20, opacity: 0 } : false}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 20,
                              delay: spinning ? 0 : colIdx * 0.1,
                            }}
                            className={`relative flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${config.color} shadow-lg ${config.glow} ${
                              spinning ? "animate-pulse" : ""
                            } ${isWinning && !spinning ? "ring-2 ring-yellow-400/50" : ""}`}
                          >
                            <span className="text-3xl drop-shadow-lg">{config.emoji}</span>
                            {isWinning && !spinning && (
                              <motion.div
                                animate={{ opacity: [0, 1, 0] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="absolute inset-0 rounded-xl border-2 border-yellow-400"
                              />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Win display */}
              <AnimatePresence>
                {showWin && result && result.totalWin > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
                    onClick={() => setShowWin(false)}
                  >
                    <div className="text-center">
                      {result.isJackpot && (
                        <motion.div
                          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                          className="mb-2"
                        >
                          <Sparkles size={48} className="mx-auto text-yellow-400" />
                          <p className="text-lg font-black text-yellow-400 uppercase tracking-widest">JACKPOT!</p>
                        </motion.div>
                      )}
                      <motion.p
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500"
                      >
                        +₹{result.totalWin.toLocaleString("en-IN")}
                      </motion.p>
                      <p className="text-sm font-bold text-white/60 mt-2">
                        {result.multiplier.toFixed(1)}x multiplier · {result.paylines.length} winning line{result.paylines.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-white/30 mt-3">Tap to dismiss</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom decorative lights */}
            <div className="flex justify-center gap-3 py-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  className="size-2 rounded-full bg-purple-400"
                />
              ))}
            </div>
          </section>

          {/* Bet Controls */}
          <section className="rounded-[28px] bg-[#12081e] border border-purple-500/20 p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Bet Amount (₹)</label>
              <div className="grid grid-cols-7 gap-1.5">
                {[2, 5, 10, 50, 100, 200, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    className={`rounded-xl py-2.5 text-xs font-black transition ${
                      betAmount === v
                        ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30"
                        : "bg-white/5 text-white/50 border border-white/10"
                    }`}
                  >
                    {v >= 1000 ? `${v / 1000}K` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Spin Button */}
            <motion.button
              whileTap={spinning ? undefined : { scale: 0.95 }}
              onClick={spin}
              disabled={spinning}
              className={`relative w-full rounded-2xl py-5 text-xl font-black text-white shadow-xl transition ${
                spinning
                  ? "bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-purple-600/30"
              }`}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}>🎰</motion.span>
                  Spinning...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap size={22} />
                  SPIN · ₹{betAmount.toLocaleString("en-IN")}
                </span>
              )}
            </motion.button>

            {/* Last result */}
            {result && !showWin && (
              <div className={`rounded-xl p-3 text-center ${
                result.totalWin > 0
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}>
                <p className={`text-lg font-black ${result.totalWin > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {result.totalWin > 0 ? `Won ₹${result.totalWin.toLocaleString("en-IN")}` : "No win this spin"}
                </p>
              </div>
            )}
          </section>

          {/* Paytable */}
          <section className="rounded-[28px] bg-[#12081e] border border-purple-500/20 p-4">
            <h2 className="text-base font-black mb-3 flex items-center gap-2">
              <Star size={18} className="text-yellow-400" />
              Paytable
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(SYMBOL_CONFIG) as [SlotSymbol, typeof SYMBOL_CONFIG[SlotSymbol]][])
                .filter(([sym]) => sym !== "wild" && sym !== "scatter")
                .map(([sym, config]) => {
                  const payouts: Record<string, number> = { cherry: 0.3, lemon: 0.5, bell: 0.8, seven: 2.0, diamond: 10.0 };
                  return (
                    <div key={sym} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 p-2.5">
                      <span className="text-2xl">{config.emoji}</span>
                      <div>
                        <p className="text-xs font-black capitalize text-white/80">{sym}</p>
                        <p className="text-[10px] font-bold text-white/40">3+ → {payouts[sym]}x</p>
                      </div>
                    </div>
                  );
                })}
              <div className="flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 p-2.5">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="text-xs font-black text-purple-400">Wild</p>
                  <p className="text-[10px] font-bold text-white/40">Substitutes</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-2.5">
                <span className="text-2xl">🌟</span>
                <div>
                  <p className="text-xs font-black text-yellow-400">Scatter</p>
                  <p className="text-[10px] font-bold text-white/40">3+ → bonus</p>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Spins */}
          <section className="rounded-[28px] bg-[#12081e] border border-purple-500/20 p-4">
            <h2 className="text-base font-black mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              Recent Spins
            </h2>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-xs font-bold text-white/30 text-center py-4">No spins yet. Hit SPIN to start!</p>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-xs font-bold text-white/40">₹{h.betAmount}</span>
                    <span className={`text-sm font-black ${h.totalWin > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {h.totalWin > 0 ? `+₹${h.totalWin}` : "-₹" + h.betAmount}
                    </span>
                    {h.isJackpot && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 rounded-full px-2 py-0.5 font-black">JACKPOT</span>}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-white/10 bg-[#0a0610]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-5 gap-1">
            {[
              { icon: "🎨", label: "Color", href: "/" },
              { icon: "🚀", label: "Crash", href: "/crash" },
              { icon: "🎰", label: "Slots", href: "/slots" },
              { icon: "🏆", label: "Jackpot", href: "/jackpot" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-[10px] font-black ${
                  item.href === "/slots" ? "bg-purple-500/20 text-purple-400" : "text-white/40"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* History Modal */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowHistory(false)}
            >
              <motion.div
                initial={{ y: 300 }}
                animate={{ y: 0 }}
                exit={{ y: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[430px] max-h-[70vh] rounded-t-3xl bg-[#12081e] border-t border-purple-500/30 p-5 overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-black">My Slot Stats</h2>
                  <button onClick={() => setShowHistory(false)} className="text-white/40 font-black">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-purple-400">{stats.totalSpins}</p>
                    <p className="text-[10px] font-bold text-white/40">Total Spins</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-emerald-400">₹{stats.totalWon.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] font-bold text-white/40">Total Won</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-amber-400">₹{stats.biggestWin.toLocaleString("en-IN")}</p>
                    <p className="text-[10px] font-bold text-white/40">Biggest Win</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-black text-yellow-400">{stats.jackpots}</p>
                    <p className="text-[10px] font-bold text-white/40">Jackpots</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
