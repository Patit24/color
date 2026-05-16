"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Gift,
  Home,
  LifeBuoy,
  Loader2,
  ShieldCheck,
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
          <WalletCard balance={balance} />

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

          <ColorWheel latestResult={latestResult} secondsLeft={secondsLeft} />

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

            <div className="mt-4 grid grid-cols-6 gap-2">
              {multipliers.map((item) => (
                <button
                  key={item}
                  onClick={() => setMultiplier(item)}
                  className={`h-9 rounded-full text-xs font-black ${
                    multiplier === item
                      ? "bg-[#2a1212] text-white"
                      : "bg-[#fff0ed] text-[#9a3434]"
                  }`}
                >
                  X{item}
                </button>
              ))}
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
            whileTap={{ scale: 0.97 }}
            onClick={placeBet}
            className="sticky top-3 z-10 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-[#ff3333] via-[#df173c] to-[#09a56a] text-base font-black text-white shadow-xl shadow-red-600/25"
          >
            <Zap size={18} />
            Bet Now · ₹{10 * multiplier}
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

function ColorWheel({
  latestResult,
  secondsLeft,
}: {
  latestResult?: GameResult;
  secondsLeft: number;
}) {
  const targetRotation = latestResult ? 1440 + (360 - latestResult.number * 36 - 18) : 0;
  const isSpinning = secondsLeft <= 2;

  return (
    <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-xl shadow-red-900/10">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black">Color Wheel</h2>
          <p className="text-xs font-bold text-[#9a3434]">In-house backend algorithm</p>
        </div>
        <span className="rounded-full bg-[#fff0ed] px-3 py-1 text-xs font-black text-[#bb102d]">
          {isSpinning ? "Spinning" : "Ready"}
        </span>
      </div>

      <div className="relative mx-auto grid size-64 place-items-center">
        <div className="absolute -top-1 z-20 h-0 w-0 border-x-[12px] border-t-[20px] border-x-transparent border-t-[#2b1215]" />
        <motion.div
          animate={{
            rotate: isSpinning ? targetRotation + 360 : targetRotation,
          }}
          transition={{
            duration: isSpinning ? 1.6 : 3.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative size-60 rounded-full border-[10px] border-[#2b1215] shadow-2xl shadow-red-900/20"
          style={{
            background:
              "conic-gradient(from -18deg, #ef4444 0deg 36deg, #22c55e 36deg 72deg, #ef4444 72deg 108deg, #22c55e 108deg 144deg, #ef4444 144deg 180deg, #22c55e 180deg 216deg, #ef4444 216deg 252deg, #22c55e 252deg 288deg, #ef4444 288deg 324deg, #22c55e 324deg 360deg)",
          }}
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_0_42%,rgba(255,255,255,0.26)_43%,transparent_44%)]" />
          {wheelSegments.map((segment) => {
            const angle = segment.number * 36 + 18;
            const hasViolet = segment.colors.includes("Violet");
            return (
              <div
                key={segment.number}
                className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-black text-[#2b1215] shadow-lg"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-82px) rotate(-${angle}deg)`,
                }}
              >
                {segment.number}
                {hasViolet && (
                  <span className="absolute -right-1 -top-1 size-3 rounded-full bg-violet-500 ring-2 ring-white" />
                )}
              </div>
            );
          })}
          <div className="absolute inset-[72px] grid place-items-center rounded-full bg-white text-center shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a3434]">
              Result
            </span>
            <span className="text-3xl font-black text-[#2b1215]">
              {latestResult?.number ?? "-"}
            </span>
          </div>
        </motion.div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-red-50 p-3 text-red-700">0 pays Red + Violet</div>
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">5 pays Green + Violet</div>
        <div className="rounded-2xl bg-[#fff0ed] p-3 text-[#9a3434]">0-4 Small · 5-9 Big</div>
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
                  row.colors.includes("Green") && !row.colors.includes("Violet")
                    ? "text-emerald-600"
                    : row.colors.includes("Red") && !row.colors.includes("Violet")
                      ? "text-red-600"
                      : "text-violet-600"
                }
              >
                {row.colors.join(" + ")}
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
      <button
        onClick={claimBonus}
        disabled={!bonusOpen}
        className="rounded-[24px] bg-gradient-to-br from-yellow-300 to-orange-500 p-4 text-left font-black text-[#351600] shadow-xl shadow-orange-500/20 disabled:opacity-60"
      >
        <Gift className="mb-3" />
        Daily bonus
        <span className="mt-1 block text-xs">Claim rewards</span>
      </button>
      <button className="rounded-[24px] bg-gradient-to-br from-sky-300 to-blue-600 p-4 text-left font-black text-white shadow-xl shadow-blue-500/20">
        <LifeBuoy className="mb-3" />
        Telegram
        <span className="mt-1 block text-xs">Support desk</span>
      </button>
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
    [Trophy, "Activity", "/history"],
    [Wallet, "Wallet", "/wallet"],
    [User, "Profile", "/profile"],
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-red-100 bg-white/90 px-4 pb-4 pt-2 shadow-2xl backdrop-blur">
      <div className="grid grid-cols-4 gap-2">
        {items.map(([Icon, label, href], index) => (
          <Link
            key={label}
            href={href}
            className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
              index === 0 ? "bg-[#fff0ed] text-[#bb102d]" : "text-[#9a3434]"
            }`}
          >
            <Icon size={20} />
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
    <div className="fixed inset-x-0 top-3 z-50 mx-auto w-full max-w-[430px] space-y-2 px-3">
      <AnimatePresence>
        {notifications.slice(0, 2).map((item) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.95 }}
            onClick={() => clearNotification(item.id)}
            className={`w-full rounded-2xl p-3 text-left text-white shadow-xl ${
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
  );
}
