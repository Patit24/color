"use client";
export default function CrashPage() {
  return <CrashGame />;
}

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Rocket,
  TrendingUp,
  Zap,
  Trophy,
  Clock,
  Wallet,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getStoredToken } from "@/lib/api-client";
import { getSocket } from "@/lib/socket";
import { auth } from "@/lib/firebase";

type RoundPhase = "WAITING" | "BETTING" | "RUNNING" | "CRASHED";

interface CrashHistoryItem {
  roundNumber: number;
  crashPoint: number;
  playerCount: number;
}

function CrashGame() {
  const [phase, setPhase] = useState<RoundPhase>("WAITING");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);
  const [bettingCountdown, setBettingCountdown] = useState(0);
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashout, setAutoCashout] = useState(0);
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashoutMultiplier, setCashoutMultiplier] = useState(0);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<CrashHistoryItem[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const multiplierHistory = useRef<number[]>([]);
  const [localStartedAt, setLocalStartedAt] = useState<number | null>(null);
  const lastServerTick = useRef<{ multiplier: number; receivedAt: number }>({ multiplier: 1.0, receivedAt: Date.now() });

  // Load history on mount
  useEffect(() => {
    apiRequest<{ rounds: CrashHistoryItem[] }>("/crash/history")
      .then((d) => setHistory(d.rounds.slice(0, 20)))
      .catch(() => {});
  }, []);

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
            console.log("Backend authorization token synced on Crash mount!");
            
            // Re-sync socket join with correct token
            const socket = getSocket();
            socket.emit("crash:join", { token: syncResponse.accessToken });
          }
        } catch (e: any) {
          console.warn("Crash mount token sync failed:", e.message);
        }
      }
    });
    return () => unsub();
  }, []);

  // Socket connection
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    
    const token = getStoredToken();
    socket.emit("crash:join", { token });

    socket.on("crash:sync", (data: any) => {
      setPhase(data.phase);
      setRoundNumber(data.roundNumber);
      setMultiplier(data.multiplier);
      setBettingCountdown(data.bettingCountdown);
      if (data.phase === "RUNNING") {
        const elapsed = Math.log(data.multiplier) / 0.15;
        setLocalStartedAt(Date.now() - elapsed * 1000);
        lastServerTick.current = { multiplier: data.multiplier, receivedAt: Date.now() };
      } else {
        setLocalStartedAt(null);
      }
      if (data.myBet) {
        setHasBet(true);
        if (data.myBet.status === "CASHED_OUT") {
          setCashedOut(true);
          setCashoutMultiplier(data.myBet.cashedOutAt);
          setPayout(data.myBet.payout);
        } else {
          setCashedOut(false);
        }
      } else {
        setHasBet(false);
        setCashedOut(false);
      }
    });

    socket.on("crash:round_start", (data: any) => {
      setPhase("BETTING");
      setRoundNumber(data.roundNumber);
      setBettingCountdown(data.bettingWindowMs / 1000);
      setMultiplier(1.0);
      setLocalStartedAt(null);
      lastServerTick.current = { multiplier: 1.0, receivedAt: Date.now() };
      setHasBet(false);
      setCashedOut(false);
      setCashoutMultiplier(0);
      setPayout(0);
      multiplierHistory.current = [1.0];
    });

    socket.on("crash:betting_countdown", (data: any) => {
      setBettingCountdown(data.seconds);
    });

    socket.on("crash:running", (data: any) => {
      setPhase("RUNNING");
      setLocalStartedAt(data.startedAt || Date.now());
      multiplierHistory.current = [1.0];
      lastServerTick.current = { multiplier: 1.0, receivedAt: Date.now() };
    });

    socket.on("crash:tick", (data: any) => {
      // High-performance network feedback controller to keep client locally in perfect sync with server
      if (data.multiplier > 1.0) {
        lastServerTick.current = { multiplier: data.multiplier, receivedAt: Date.now() };
        const serverElapsed = Math.log(data.multiplier) / 0.15;
        const targetStartedAt = Date.now() - serverElapsed * 1000;
        setLocalStartedAt((prev) => {
          if (!prev) return targetStartedAt;
          return prev * 0.9 + targetStartedAt * 0.1;
        });
      }
    });

    socket.on("crash:crashed", (data: any) => {
      setPhase("CRASHED");
      setLocalStartedAt(null);
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);
      setHistory((prev) => [
        {
          roundNumber: data.roundNumber,
          crashPoint: data.crashPoint,
          playerCount: data.playerCount,
        },
        ...prev.slice(0, 19),
      ]);
    });

    socket.on("crash:bet_confirmed", () => {
      setHasBet(true);
    });

    socket.on("crash:my_cashout", (data: any) => {
      setCashedOut(true);
      setCashoutMultiplier(data.multiplier);
      setPayout(data.payout);
    });

    socket.on("crash:cashout_success", (data: any) => {
      setCashedOut(true);
      setCashoutMultiplier(data.multiplier);
      setPayout(data.payout);
    });

    socket.on("crash:error", (data: any) => {
      alert(data.message);
    });

    return () => {
      socket.emit("crash:leave");
      socket.off("crash:sync");
      socket.off("crash:round_start");
      socket.off("crash:betting_countdown");
      socket.off("crash:running");
      socket.off("crash:tick");
      socket.off("crash:crashed");
      socket.off("crash:bet_confirmed");
      socket.off("crash:my_cashout");
      socket.off("crash:cashout_success");
      socket.off("crash:error");
    };
  }, []);

  // 60 FPS Multiplier and History Update loop
  useEffect(() => {
    if (phase !== "RUNNING" || !localStartedAt) return;

    let animId: number;
    const updateLoop = () => {
      const now = Date.now();
      const elapsed = (now - localStartedAt) / 1000;
      let currentMult = Math.pow(Math.E, 0.15 * elapsed);

      // CAPPING: Prevent client from extrapolating more than 200ms ahead of the last server tick.
      // Growth in 200ms: multiplier * e^(0.15 * 0.2) = multiplier * 1.0304
      const timeSinceLastTick = (now - lastServerTick.current.receivedAt) / 1000;
      const maxExtrapolatedMult = lastServerTick.current.multiplier * Math.pow(Math.E, 0.15 * Math.min(0.20, timeSinceLastTick));
      
      if (currentMult > maxExtrapolatedMult) {
        currentMult = maxExtrapolatedMult;
      }

      setMultiplier(currentMult);

      const history = multiplierHistory.current;
      if (history.length === 0 || currentMult > history[history.length - 1]) {
        history.push(currentMult);
        if (history.length > 800) history.shift();
      }

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animId);
  }, [phase, localStartedAt]);

  // Draw ultra-smooth 60 FPS animation graph and space warp starfield
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    let animId: number;

    // Initialize 40 stars
    const stars: Array<{ x: number; y: number; speed: number; size: number }> = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.5 + Math.random() * 1.5,
        size: 0.5 + Math.random() * 1.5,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Current multiplier for warp speed acceleration
      const points = multiplierHistory.current;
      const currentMult = points[points.length - 1] || 1.0;
      const warpFactor = Math.min(12, 1 + (currentMult - 1) * 1.8);

      // 1. Draw starfield
      for (const star of stars) {
        if (phase === "RUNNING") {
          star.x -= star.speed * warpFactor * 0.8;
          star.y += star.speed * warpFactor * 0.45;
        } else {
          // Slow passive drifting
          star.x -= star.speed * 0.25;
          star.y += star.speed * 0.15;
        }

        // Warp bounds check
        if (star.x < 0) {
          star.x = w;
          star.y = Math.random() * h;
        }
        if (star.y > h) {
          star.y = 0;
          star.x = Math.random() * w;
        }

        ctx.beginPath();
        // Warp stretch line effect
        ctx.strokeStyle = `rgba(129, 140, 248, ${0.15 + star.size * 0.25})`;
        ctx.lineWidth = star.size;
        ctx.moveTo(star.x, star.y);
        if (phase === "RUNNING") {
          ctx.lineTo(star.x + star.speed * warpFactor * 1.8, star.y - star.speed * warpFactor * 1.0);
        } else {
          ctx.lineTo(star.x + star.size * 2, star.y - star.size * 1);
        }
        ctx.stroke();
      }

      // 2. Draw modern Indigo glowing Grid
      ctx.strokeStyle = "rgba(99, 102, 241, 0.05)";
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      const gridOffsetX = (currentMult * -50) % gridSpacing;
      const gridOffsetY = (currentMult * 30) % gridSpacing;

      for (let x = gridOffsetX; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = gridOffsetY; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Draw curve points
      if (points.length >= 2) {
        const maxM = Math.max(...points, 2.0);
        const xStep = w / Math.max(points.length - 1, 1);

        // Gradient fill under the curve
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        if (phase === "CRASHED") {
          gradient.addColorStop(0, "rgba(239, 68, 68, 0)");
          gradient.addColorStop(1, "rgba(239, 68, 68, 0.22)");
        } else {
          gradient.addColorStop(0, "rgba(99, 102, 241, 0)");
          gradient.addColorStop(1, "rgba(16, 185, 129, 0.25)");
        }

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < points.length; i++) {
          const x = i * xStep;
          const y = h - ((points[i] - 1) / (maxM - 1)) * (h * 0.82);
          ctx.lineTo(x, y);
        }
        ctx.lineTo((points.length - 1) * xStep, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Neon curve stroke with shadow glow
        ctx.beginPath();
        ctx.strokeStyle = phase === "CRASHED" ? "#ef4444" : "#10b981";
        ctx.lineWidth = 4.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = phase === "CRASHED" ? "#ef4444" : "#10b981";
        ctx.shadowBlur = 12;

        for (let i = 0; i < points.length; i++) {
          const x = i * xStep;
          const y = h - ((points[i] - 1) / (maxM - 1)) * (h * 0.82);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // Glow dot & flame thruster
        const lastX = (points.length - 1) * xStep;
        const lastY = h - ((points[points.length - 1] - 1) / (maxM - 1)) * (h * 0.82);

        // Dynamic Thruster Flame
        if (phase === "RUNNING") {
          ctx.beginPath();
          ctx.moveTo(lastX - 6, lastY + 1);
          ctx.lineTo(lastX - 22 - Math.random() * 8, lastY + 5 + Math.random() * 4);
          ctx.lineTo(lastX - 6, lastY + 9);
          ctx.fillStyle = "rgba(249, 115, 22, 0.85)";
          ctx.fill();
        }

        // Draw Dot rings
        ctx.beginPath();
        ctx.arc(lastX, lastY, 15, 0, Math.PI * 2);
        ctx.fillStyle = phase === "CRASHED" ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
        ctx.fillStyle = phase === "CRASHED" ? "#ef4444" : "#10b981";
        ctx.fill();
      }

      if (phase === "RUNNING") {
        animId = requestAnimationFrame(draw);
      }
    };

    if (phase === "RUNNING") {
      animId = requestAnimationFrame(draw);
    } else {
      draw();
    }

    return () => cancelAnimationFrame(animId);
  }, [phase, multiplier]);

  const placeBet = useCallback(() => {
    const token = getStoredToken();
    if (!token) return alert("Please login first");
    const socket = getSocket();
    socket.emit("crash:place_bet", { amount: betAmount, autoCashout, token });
  }, [betAmount, autoCashout]);

  const cashout = useCallback(() => {
    const token = getStoredToken();
    if (!token) return;
    const socket = getSocket();
    socket.emit("crash:cashout", { token });
  }, []);

  const potentialWin = hasBet && !cashedOut ? Math.round(betAmount * multiplier) : 0;

  return (
    <main className="min-h-screen bg-[#0a0a12] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#1a0a2e] via-[#16213e] to-[#0f3460] px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <Rocket size={20} className="text-orange-400" /> Crash
              </h1>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Real-time multiplier</p>
            </div>
          </div>
          <button onClick={() => setSoundOn(!soundOn)} className="grid size-9 place-items-center rounded-full bg-white/10">
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </header>

        <div className="space-y-3 px-3 pb-28 pt-3">
          {/* History Bar */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {history.map((h, idx) => (
              <span
                key={`${h.roundNumber}-${idx}`}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black ${
                  h.crashPoint >= 2
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {h.crashPoint.toFixed(2)}x
              </span>
            ))}
          </div>

          {/* Main Game Canvas */}
          <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f0c29] via-[#1a1a3e] to-[#0f0c29] border border-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_70%)]" />

            <div className="relative p-4">
              {/* Round Info */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white/40">Round #{roundNumber}</span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                  phase === "BETTING" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" :
                  phase === "RUNNING" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                  phase === "CRASHED" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                  "bg-white/10 text-white/50"
                }`}>
                  {phase === "BETTING" ? `Betting ${Math.ceil(bettingCountdown)}s` :
                   phase === "RUNNING" ? "LIVE" :
                   phase === "CRASHED" ? "CRASHED" : "WAITING"}
                </span>
              </div>

              {/* Canvas Graph */}
              <div className="relative h-[220px] w-full">
                <canvas
                  ref={canvasRef}
                  className="h-full w-full block"
                />

                {/* Overlay Multiplier */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {phase === "BETTING" && (
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-center bg-[#0a0a12]/60 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/5"
                    >
                      <Rocket size={48} className="mx-auto mb-2 text-orange-400" />
                      <p className="text-3xl font-black text-white">Place Bets</p>
                      <p className="text-base font-bold text-amber-400 mt-0.5">{Math.ceil(bettingCountdown)}s remaining</p>
                    </motion.div>
                  )}

                  {phase === "WAITING" && (
                    <div className="text-center">
                      <Clock size={48} className="mx-auto mb-3 text-white/30" />
                      <p className="text-xl font-bold text-white/40">Waiting for next round...</p>
                    </div>
                  )}

                  {(phase === "RUNNING" || phase === "CRASHED") && (
                    <motion.p
                      key={multiplier.toFixed(2)}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className={`text-6xl font-black drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] ${
                        phase === "CRASHED"
                          ? "text-red-500"
                          : multiplier >= 5
                            ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500"
                            : multiplier >= 2
                              ? "text-emerald-400"
                              : "text-white"
                      }`}
                    >
                      {multiplier.toFixed(2)}x
                    </motion.p>
                  )}

                  {phase === "CRASHED" && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-black text-red-400 mt-2 uppercase tracking-widest"
                    >
                      Crashed!
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Cashout notification */}
              <AnimatePresence>
                {cashedOut && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 p-3 text-center"
                  >
                    <p className="text-sm font-bold text-emerald-400">
                      Cashed out at {cashoutMultiplier.toFixed(2)}x — Won ₹{payout.toLocaleString("en-IN")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Betting Controls */}
          <section className="rounded-[28px] bg-[#12121e] border border-white/10 p-4 space-y-4 shadow-xl">
            {/* Bet Amount */}
            <div>
              <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block flex items-center justify-between">
                <span>Bet Amount (₹)</span>
                <span className="text-[10px] text-indigo-400 font-extrabold bg-indigo-500/10 px-2 py-0.5 rounded-full">Min ₹2 · Max ₹10k</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(2, Math.min(10000, Number(e.target.value) || 0)))}
                  className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-lg font-black text-white outline-none focus:border-indigo-500 transition focus:ring-2 focus:ring-indigo-500/20"
                  min={2}
                  max={10000}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => setBetAmount((prev) => Math.max(2, Math.floor(prev / 2)))}
                    className="rounded-xl px-3 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-black transition"
                  >
                    ½
                  </button>
                  <button
                    onClick={() => setBetAmount((prev) => Math.min(10000, prev * 2))}
                    className="rounded-xl px-3 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-black transition"
                  >
                    2x
                  </button>
                  <button
                    onClick={() => setBetAmount(2)}
                    className="rounded-xl px-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-[10px] font-black transition uppercase"
                  >
                    Min
                  </button>
                  <button
                    onClick={() => setBetAmount(10000)}
                    className="rounded-xl px-2.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-[10px] font-black transition uppercase"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Incremental Quick Adds */}
              <div className="flex gap-1 mt-2">
                {[10, 50, 100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBetAmount((prev) => Math.min(10000, prev + v))}
                    className="flex-1 rounded-xl py-2 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-[11px] font-extrabold transition"
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Cashout */}
            <div>
              <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block flex items-center justify-between">
                <span>Auto Cashout (Multiplier)</span>
                <span className="text-[10px] text-orange-400 font-extrabold bg-orange-500/10 px-2 py-0.5 rounded-full">0 = Manual</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(Number(e.target.value))}
                  className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-lg font-black text-white outline-none focus:border-orange-500 transition focus:ring-2 focus:ring-orange-500/20"
                  min={0}
                />
                <div className="flex gap-1">
                  {[1.5, 2, 3, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAutoCashout(v)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                        autoCashout === v ? "bg-orange-600 text-white" : "bg-white/5 text-white/60 border border-white/10"
                      }`}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Potential Win */}
            {hasBet && !cashedOut && phase === "RUNNING" && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-xs font-bold text-white/40">Potential Win</p>
                <p className="text-2xl font-black text-emerald-400">
                  ₹{potentialWin.toLocaleString("en-IN")}
                </p>
              </div>
            )}

            {/* Action Button */}
            {phase === "BETTING" && !hasBet ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={placeBet}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 py-4 text-lg font-black text-white shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 transition-all duration-300"
              >
                <Zap size={20} className="inline mr-2" />
                Place Bet · ₹{betAmount.toLocaleString("en-IN")}
              </motion.button>
            ) : phase === "RUNNING" && hasBet && !cashedOut ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={cashout}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-lg font-black text-white shadow-xl shadow-green-600/30 animate-pulse hover:shadow-green-600/50 transition-all duration-300"
              >
                <TrendingUp size={20} className="inline mr-2" />
                Cash Out · {multiplier.toFixed(2)}x (₹{potentialWin.toLocaleString("en-IN")})
              </motion.button>
            ) : phase === "BETTING" && hasBet ? (
              <div className="w-full rounded-2xl bg-amber-500/20 border border-amber-500/30 py-4 text-center text-amber-400 font-black shadow-lg">
                Bet placed! Waiting for launch...
              </div>
            ) : (
              <div className="w-full rounded-2xl bg-white/5 border border-white/10 py-4 text-center text-white/30 font-black">
                {phase === "CRASHED" ? "Next round starting soon..." : "Waiting for round..."}
              </div>
            )}
          </section>

          {/* History Table */}
          <section className="rounded-[28px] bg-[#12121e] border border-white/10 p-4">
            <h2 className="text-base font-black mb-3 flex items-center gap-2">
              <Trophy size={18} className="text-amber-400" />
              Recent Crashes
            </h2>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {history.map((h, idx) => (
                <div key={`${h.roundNumber}-${idx}`} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span className="text-xs font-bold text-white/40">#{h.roundNumber}</span>
                  <span className={`text-sm font-black ${h.crashPoint >= 2 ? "text-emerald-400" : "text-red-400"}`}>
                    {h.crashPoint.toFixed(2)}x
                  </span>
                  <span className="text-xs text-white/30">{h.playerCount} players</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-white/10 bg-[#0a0a12]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🎨", label: "Color", href: "/" },
              { icon: "🚀", label: "Crash", href: "/crash" },
              { icon: "🎰", label: "Slots", href: "/slots" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
                  item.href === "/crash" ? "bg-indigo-500/20 text-indigo-400" : "text-white/40"
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
