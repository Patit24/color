"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Gift,
  Home,
  LifeBuoy,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  gameTabs,
  formatMoney,
  multipliers,
  secondsForMode,
  wheelSegments,
  type BetTarget,
  type GameResult,
} from "@/lib/game";
import { useLiveGame } from "@/hooks/use-live-game";
import { useGameStore } from "@/store/game-store";

const colorOptions: Array<{
  id: BetTarget;
  label: string;
  className: string;
}> = [
  { id: "green", label: "Green", className: "from-emerald-400 to-green-600" },
  { id: "violet", label: "Violet", className: "from-fuchsia-400 to-violet-700" },
  { id: "red", label: "Red", className: "from-rose-400 to-red-700" },
];

const adminCards = [
  ["Game result", "Provably fair RNG"],
  ["Users", "Admin token required"],
  ["Deposits", "API approval queue"],
  ["Withdrawals", "API approval queue"],
  ["Banned users", "Audit logged"],
  ["Total earnings", "Metrics API"],
];

export function MobileDashboard() {
  const {
    activeTab,
    balance,
    winBalance,
    bonusOpen,
    claimBonus,
    clearNotification,
    multiplier,
    notifications,
    onlineUsers,
    period,
    placeBet,
    realtimeStatus,
    secondsLeft,
    selectedTarget,
    setActiveTab,
    setMultiplier,
    setSelectedTarget,
    baseStake,
    setBaseStake,
  } = useGameStore();
  const latestResult = useGameStore((state) => state.history[0]);

  useLiveGame();

  const timerParts = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [secondsLeft]);

  const roundDuration = secondsForMode(activeTab);

  return (
    <main className="min-h-screen bg-[#fff7f4] text-[#2a1212]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fff7f4] shadow-2xl shadow-black/20">
        <TopBar onlineUsers={onlineUsers} realtimeStatus={realtimeStatus} />

        <div className="space-y-4 px-3 pb-28 pt-3">
          <WalletCard balance={balance + winBalance} />

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] bg-white p-2 shadow-xl shadow-red-900/10"
          >
            <div className="grid grid-cols-4 gap-2">
              {gameTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-2xl px-2 py-3 text-xs font-black transition ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-[#ff4b4b] to-[#b71234] text-white shadow-lg shadow-red-500/25"
                      : "bg-[#fff0ed] text-[#a23c3c]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </motion.section>

          <TimerCard
            period={period}
            timer={timerParts}
            secondsLeft={secondsLeft}
            roundDuration={roundDuration}
            realtimeStatus={realtimeStatus}
          />

          <DisplayBoard latestResult={latestResult} secondsLeft={secondsLeft} />

          <section className="rounded-[28px] bg-white p-3 shadow-xl shadow-red-900/10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black">Choose Color</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Live bets
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {colorOptions.map((option) => (
                <motion.button
                  key={option.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSelectedTarget(option.id)}
                  className={`rounded-2xl bg-gradient-to-br ${option.className} px-2 py-4 text-sm font-black text-white shadow-lg ${
                    selectedTarget === option.id ? "ring-4 ring-yellow-300" : ""
                  }`}
                >
                  {option.label}
                </motion.button>
              ))}
            </div>

            {/* Stake Amount Selector */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">Stake Amount (₹)</span>
                <span className="text-xs font-black text-[#9a3434] bg-[#fff0ed] px-2 py-0.5 rounded-md">Selected: ₹{baseStake}</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scroll">
                {[2, 5, 10, 50, 100, 500, 1000].map((stake) => (
                  <button
                    key={stake}
                    onClick={() => setBaseStake(stake)}
                    className={`h-9 px-4 rounded-full text-xs font-black shrink-0 transition-all ${
                      baseStake === stake
                        ? "bg-[#df173c] text-white shadow-md shadow-red-500/20 scale-105"
                        : "bg-[#fff0ed] text-[#9a3434] hover:bg-[#ffe3dc]"
                    }`}
                  >
                    ₹{stake}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiplier Selector */}
            <div className="flex flex-col gap-2 mt-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-500 uppercase tracking-wider">Multiplier (X)</span>
                <span className="text-xs font-black text-[#2a1212] bg-neutral-100 px-2 py-0.5 rounded-md">Selected: X{multiplier}</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scroll">
                {multipliers.map((item) => (
                  <button
                    key={item}
                    onClick={() => setMultiplier(item)}
                    className={`h-9 w-11 rounded-full text-xs font-black shrink-0 transition-all ${
                      multiplier === item
                        ? "bg-[#2a1212] text-white shadow-md scale-105"
                        : "bg-[#fff0ed] text-[#9a3434] hover:bg-[#ffe3dc]"
                    }`}
                  >
                    X{item}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-3 shadow-xl shadow-red-900/10">
            <h2 className="mb-3 text-base font-black">Number Prediction</h2>
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 10 }, (_, number) => {
                const id = `number-${number}` as BetTarget;
                const active = selectedTarget === id;
                const segment = wheelSegments[number];
                const hasViolet = segment.colors.includes("Violet");
                const isRed = segment.colors.includes("Red");
                return (
                  <motion.button
                    key={number}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedTarget(id)}
                    className={`grid aspect-square place-items-center rounded-full border-4 bg-white text-xl font-black shadow-md transition ${
                      active
                        ? "border-yellow-300 bg-yellow-50 text-red-700 shadow-yellow-200"
                        : hasViolet
                          ? "border-violet-400 text-violet-700"
                          : isRed
                            ? "border-red-400 text-red-700"
                            : "border-emerald-400 text-emerald-700"
                    }`}
                  >
                    {number}
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 overflow-hidden rounded-[28px] bg-white p-2 shadow-xl shadow-red-900/10">
            {(["big", "small"] as BetTarget[]).map((item) => (
              <button
                key={item}
                onClick={() => setSelectedTarget(item)}
                className={`h-14 text-base font-black transition ${
                  selectedTarget === item
                    ? item === "big"
                      ? "rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white"
                      : "rounded-2xl bg-gradient-to-r from-sky-400 to-blue-600 text-white"
                    : "text-[#a23c3c]"
                }`}
              >
                {item === "big" ? "Big" : "Small"}
              </button>
            ))}
          </section>

          <motion.button
            whileTap={secondsLeft > 5 ? { scale: 0.97 } : undefined}
            onClick={secondsLeft > 5 ? placeBet : undefined}
            disabled={secondsLeft <= 5}
            className={`sticky top-3 z-10 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-base font-black text-white shadow-xl transition-all duration-300 ${
              secondsLeft <= 5 
                ? "bg-neutral-800 text-neutral-500 shadow-none cursor-not-allowed border border-neutral-700/50" 
                : "bg-gradient-to-r from-[#ff3333] via-[#df173c] to-[#09a56a] shadow-red-600/25"
            }`}
          >
            {secondsLeft <= 5 ? (
              <>
                <Lock size={18} className="animate-pulse" />
                Betting Locked ({secondsLeft}s)
              </>
            ) : (
              <>
                <Zap size={18} />
                Bet Now · ₹{baseStake * multiplier}
              </>
            )}
          </motion.button>

          <HistoryTable />
          <MyHistory />
          <Extras claimBonus={claimBonus} bonusOpen={bonusOpen} />
          <AdminPanel />
        </div>

        <BottomNav />
        <Notifications notifications={notifications} clearNotification={clearNotification} />
      </div>
    </main>
  );
}

function DisplayBoard({
  latestResult,
  secondsLeft,
}: {
  latestResult?: GameResult;
  secondsLeft: number;
}) {
  const isSettling = secondsLeft <= 5;
  const numbers = Array.from({ length: 10 }, (_, i) => i);

  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#12090d] to-[#1a0f14] p-5 shadow-2xl shadow-red-900/40 border border-white/10">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 blur-[60px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/20 blur-[60px] pointer-events-none rounded-full" />

      {/* Header */}
      <div className="relative mb-5 flex items-center justify-between z-10">
        <div>
          <h2 className="text-xl font-black text-white drop-shadow-md flex items-center gap-2">
            <span className="w-2 h-6 bg-red-500 rounded-full inline-block animate-pulse"></span>
            LIVE BOARD
          </h2>
          <p className="text-[10px] font-bold text-white/50 tracking-[0.2em] uppercase mt-1">Provably Fair Draw</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md ${isSettling ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
          {isSettling ? "Settling..." : "Betting Open"}
        </span>
      </div>

      {/* Board Grid Area */}
      <div className="relative z-10 bg-black/40 rounded-2xl p-4 border border-white/5 shadow-inner mb-4">
        
        {isSettling ? (
          <div className="flex flex-col items-center justify-center py-6 animate-fade-in">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Next round starts in</p>
            <motion.p 
              key={secondsLeft}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-orange-500 to-red-600 drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]"
            >
              0{secondsLeft}s
            </motion.p>
            <p className="text-xs font-black text-red-400 mt-4 animate-pulse uppercase tracking-widest">
              No more bets
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Number Grid */}
            <div className="grid grid-cols-5 gap-2">
              {numbers.map((num) => {
                const segment = wheelSegments[num];
                const hasViolet = segment.colors.includes("Violet");
                const mainColor = segment.colors.includes("Red") ? "bg-gradient-to-b from-rose-500 to-red-600" : "bg-gradient-to-b from-emerald-400 to-green-600";
                
                return (
                  <div key={num} className="relative group">
                    <div className={`relative flex h-12 w-full items-center justify-center rounded-xl shadow-lg border border-white/10 ${mainColor}`}>
                      <span className="text-xl font-black text-white drop-shadow-md">{num}</span>
                      {hasViolet && (
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-50 clip-half" style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Previous Result Reveal Board */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Latest Draw</p>
          {latestResult ? (
            <div className="flex items-center gap-3">
              <span className={`grid size-12 place-items-center rounded-xl text-2xl font-black text-white shadow-lg ${
                latestResult.color.toLowerCase() === "green" 
                  ? "bg-gradient-to-br from-emerald-400 to-green-600" 
                  : latestResult.color.toLowerCase() === "red" 
                    ? "bg-gradient-to-br from-rose-500 to-red-600" 
                    : "bg-gradient-to-br from-fuchsia-500 to-violet-600"
              }`}>
                {latestResult.number}
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  {latestResult.colors ? latestResult.colors.map(col => (
                    <span key={col} className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white ${
                      col.toLowerCase() === "green" ? "bg-emerald-500" : col.toLowerCase() === "red" ? "bg-red-500" : "bg-purple-500"
                    }`}>
                      {col}
                    </span>
                  )) : (
                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white ${
                      latestResult.color.toLowerCase() === "green" ? "bg-emerald-500" : latestResult.color.toLowerCase() === "red" ? "bg-red-500" : "bg-purple-500"
                    }`}>
                      {latestResult.color}
                    </span>
                  )}
                </div>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider w-fit ${
                  latestResult.size.toLowerCase() === "big"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                }`}>
                  {latestResult.size}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/50 animate-pulse">
              <div className="size-12 rounded-xl bg-white/5 border border-white/10" />
              <p className="text-xs font-bold">Waiting...</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TopBar({
  onlineUsers,
  realtimeStatus,
}: {
  onlineUsers: number;
  realtimeStatus: "connecting" | "live" | "offline";
}) {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#bb102d] via-[#f2373f] to-[#0ba668] px-4 pb-5 pt-4 text-white shadow-lg shadow-red-900/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Color Pro</p>
          <h1 className="text-2xl font-black tracking-tight">Win Go Lobby</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur">
            <Bell size={18} />
          </button>
          <button className="grid size-10 place-items-center rounded-full bg-white text-[#bb102d]">
            <User size={18} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 px-3 py-2 text-xs font-bold backdrop-blur">
        <span className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${
              realtimeStatus === "live"
                ? "animate-pulse bg-emerald-200"
                : realtimeStatus === "connecting"
                  ? "animate-pulse bg-yellow-200"
                  : "bg-red-200"
            }`}
          />
          {realtimeStatus === "live"
            ? `${onlineUsers.toLocaleString("en-IN")} online`
            : realtimeStatus === "connecting"
              ? "Connecting"
              : "Backend offline"}
        </span>
        <span>Referral after login</span>
      </div>
    </header>
  );
}

function WalletCard({ balance }: { balance: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#361014] via-[#d7193f] to-[#0ba668] p-4 text-white shadow-2xl shadow-red-700/30"
    >
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-white/20 blur-xl" />
      <div className="relative">
        <p className="text-sm font-bold text-white/75">Wallet Balance</p>
        <motion.p
          animate={{ textShadow: ["0 0 0px #fff", "0 0 18px #fff", "0 0 0px #fff"] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="mt-2 text-4xl font-black tracking-tight"
        >
          {formatMoney(balance)}
        </motion.p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/deposit"
            className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-[#bb102d]"
          >
            Deposit
          </Link>
          <Link
            href="/withdraw"
            className="rounded-2xl border border-white/60 px-4 py-3 text-center text-sm font-black text-white"
          >
            Withdraw
          </Link>
        </div>
      </div>
    </motion.section>
  );
}

function TimerCard({
  period,
  timer,
  secondsLeft,
  roundDuration,
  realtimeStatus,
}: {
  period: string;
  timer: string;
  secondsLeft: number;
  roundDuration: number;
  realtimeStatus: "connecting" | "live" | "offline";
}) {
  return (
    <section className="rounded-[28px] bg-[#2b1215] p-4 text-white shadow-xl shadow-red-900/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Current period</p>
          <p className="mt-1 text-lg font-black">{period}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Time left</p>
          <motion.p
            key={timer}
            initial={{ scale: 0.88, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-1 font-mono text-4xl font-black"
          >
            {timer}
          </motion.p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${Math.max(0, Math.min(100, (secondsLeft / roundDuration) * 100))}%` }}
          className="h-full rounded-full bg-gradient-to-r from-green-300 via-yellow-300 to-red-400"
        />
      </div>
      <p className="mt-2 text-xs text-white/50">
        {realtimeStatus === "live"
          ? "Betting locks during final 5 seconds"
          : "Start the backend API to receive live rounds"}
      </p>
    </section>
  );
}

function HistoryTable() {
  const history = useGameStore((state) => state.history);
  return (
    <section className="rounded-[28px] bg-white p-3 shadow-xl shadow-red-900/10">
      <h2 className="mb-3 text-base font-black">Game History</h2>
      <div className="overflow-hidden rounded-2xl border border-red-100">
        <div className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.9fr] bg-[#b91230] px-3 py-2 text-xs font-black text-white">
          <span>Period</span>
          <span>No.</span>
          <span>Big/Small</span>
          <span>Color</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {history.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs font-bold text-[#9a3434]">
              Waiting for settled backend rounds.
            </div>
          ) : (
            history.map((row) => (
              <div
                key={row.period}
                className="grid grid-cols-[1.4fr_0.6fr_0.8fr_0.9fr] items-center border-t border-red-50 px-3 py-2 text-xs font-bold"
              >
                <span className="truncate text-[#8e3434]">{row.period}</span>
                <span className="text-lg font-black text-[#2a1212]">{row.number}</span>
                <span>{row.size}</span>
                <span
                  className={
                  row.colors?.includes("Green") && !row.colors?.includes("Violet")
                    ? "text-emerald-600"
                    : row.colors?.includes("Red") && !row.colors?.includes("Violet")
                      ? "text-red-600"
                      : "text-violet-600"
                }
              >
                {row.colors?.join(" + ") || row.color}
              </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function MyHistory() {
  const myHistory = useGameStore((state) => state.myHistory);
  return (
    <section className="rounded-[28px] bg-white p-3 shadow-xl shadow-red-900/10">
      <h2 className="mb-3 text-base font-black">My History</h2>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {myHistory.length === 0 ? (
          <div className="rounded-2xl bg-[#fff0ed] p-5 text-center text-xs font-bold text-[#9a3434]">
            Login and place a backend bet to populate history.
          </div>
        ) : (
          myHistory.map((bet) => (
            <div key={bet.id} className="flex items-center justify-between rounded-2xl bg-[#fff0ed] p-3">
              <div>
                <p className="font-black">{bet.target}</p>
                <p className="text-xs font-bold text-[#9a3434]">{bet.period}</p>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    bet.status === "Won"
                      ? "bg-emerald-100 text-emerald-700"
                      : bet.status === "Lost"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {bet.status}
                </span>
                <p className={`mt-1 text-sm font-black ${bet.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {bet.profit >= 0 ? "+" : ""}
                  {formatMoney(bet.profit)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Extras({
  claimBonus,
  bonusOpen,
}: {
  claimBonus: () => void;
  bonusOpen: boolean;
}) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <Link
        href="/jackpot"
        className="col-span-2 relative overflow-hidden flex items-center justify-between rounded-[24px] bg-gradient-to-r from-[#3d1a00] via-[#7b3500] to-[#3d1a00] border border-yellow-500/30 p-4 shadow-xl shadow-yellow-900/30"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />
        <span className="relative">
          <span className="text-2xl mb-1 block">🏆</span>
          <span className="font-black text-yellow-300 text-base block leading-none">Progressive Jackpot</span>
          <span className="mt-1 block text-xs text-yellow-200/60">Mini · Major · Mega pools</span>
        </span>
        <span className="relative flex flex-col items-end gap-1.5">
          <span className="text-xs font-black text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-3 py-1 animate-pulse">PLAY NOW</span>
          <span className="text-[10px] text-yellow-300/50">Bonus chest rounds 🎁</span>
        </span>
      </Link>
      <button
        onClick={claimBonus}
        disabled={!bonusOpen}
        className="rounded-[24px] bg-gradient-to-br from-yellow-300 to-orange-500 p-4 text-left font-black text-[#351600] shadow-xl shadow-orange-500/20 disabled:opacity-60"
      >
        <Gift className="mb-3" />
        Daily bonus
        <span className="mt-1 block text-xs">Claim rewards</span>
      </button>
      <a
        href="https://t.me/+qyUbQmFRHmA4Njdl"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-[24px] bg-gradient-to-br from-sky-300 to-blue-600 p-4 text-left font-black text-white shadow-xl shadow-blue-500/20 block"
      >
        <LifeBuoy className="mb-3" />
        Telegram
        <span className="mt-1 block text-xs">Support desk</span>
      </a>
      <Link
        href="/refer"
        className="col-span-2 flex items-center justify-between rounded-[24px] bg-gradient-to-r from-[#bb102d] to-[#0ba668] p-4 text-left font-black text-white shadow-xl shadow-red-900/20"
      >
        <span>
          Refer & Earn ₹50
          <span className="mt-1 block text-xs text-white/75">Invite friends and get rewards on their deposits</span>
        </span>
        <Gift className="animate-bounce" />
      </Link>

    </section>
  );
}

function AdminPanel() {
  return (
    <section className="rounded-[28px] bg-[#2b1215] p-3 text-white shadow-xl shadow-red-900/20">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-emerald-300" />
        <h2 className="text-base font-black">Admin Panel</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {adminCards.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold text-white/50">{label}</p>
            <p className="mt-1 text-sm font-black">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomNav() {
  const items = [
    [Home, "Home", "/"],
    [Zap, "Crash", "/crash"],
    [Trophy, "Slots", "/slots"],
    [Sparkles, "Jackpot", "/jackpot"],
    [Wallet, "Wallet", "/wallet"],
    [User, "Profile", "/profile"],
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-red-100 bg-white/90 px-4 pb-4 pt-2 shadow-2xl backdrop-blur">
      <div className="grid grid-cols-6 gap-1">
        {items.map(([Icon, label, href], index) => (
          <Link
            key={label}
            href={href}
            className={`grid place-items-center gap-1 rounded-2xl py-2 text-[10px] font-black ${
              index === 0 ? "bg-[#fff0ed] text-[#bb102d]" : "text-[#9a3434]"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Notifications({
  notifications,
  clearNotification,
}: {
  notifications: Array<{ id: string; title: string; message: string; tone: "win" | "loss" | "info" }>;
  clearNotification: (id: string) => void;
}) {
  return (
    <>
      <AnimatePresence>
        {notifications
          .filter((n) => n.title.includes("Bet Won!") || n.title.includes("Bet Lost"))
          .map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className={`w-full max-w-[320px] overflow-hidden rounded-[32px] text-center shadow-2xl ${
                  item.tone === "win"
                    ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-green-600/50"
                    : "bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-red-600/50"
                }`}
              >
                <div className="px-6 py-12">
                  <div className="mx-auto mb-6 flex size-32 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.5)] backdrop-blur-md">
                    {item.tone === "win" ? (
                      <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f911/512.gif" alt="Win" className="size-24 object-contain" />
                    ) : (
                      <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.gif" alt="Loss" className="size-24 object-contain" />
                    )}
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                    {item.tone === "win" ? "YOU WON" : "YOU LOST"}
                  </h2>
                  <p className="mt-2 text-xl font-bold text-white/90">{item.message}</p>
                </div>
                <button
                  onClick={() => clearNotification(item.id)}
                  className="w-full bg-white/10 py-5 text-sm font-black uppercase tracking-widest transition hover:bg-white/20 active:bg-white/30"
                >
                  Continue
                </button>
              </motion.div>
            </motion.div>
          ))}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-[430px] space-y-2 px-3">
        <AnimatePresence>
          {notifications
            .filter((n) => !n.title.includes("Bet Won!") && !n.title.includes("Bet Lost"))
            .slice(0, 2)
            .map((item) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: -18, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -18, scale: 0.95 }}
                onClick={() => clearNotification(item.id)}
                className={`pointer-events-auto w-full rounded-2xl p-3 text-left text-white shadow-xl ${
                  item.tone === "win"
                    ? "bg-emerald-600"
                    : item.tone === "loss"
                      ? "bg-red-600"
                      : "bg-[#2b1215]"
                }`}
              >
                <p className="font-black">{item.title}</p>
                <p className="text-xs text-white/75">{item.message}</p>
              </motion.button>
            ))}
        </AnimatePresence>
      </div>
    </>
  );
}
