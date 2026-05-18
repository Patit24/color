"use client";
export default function JackpotPage() { return <JackpotSlot />; }

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Trophy, Zap, Star, Gift } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getStoredToken } from "@/lib/api-client";
import { auth } from "@/lib/firebase";

type JpSymbol = "cherry"|"lemon"|"bell"|"seven"|"diamond"|"chest"|"crown";

const SYM: Record<JpSymbol,{emoji:string;color:string}> = {
  cherry:  { emoji:"🍒", color:"from-red-500 to-rose-600" },
  lemon:   { emoji:"🍋", color:"from-yellow-400 to-amber-500" },
  bell:    { emoji:"🔔", color:"from-amber-400 to-orange-500" },
  seven:   { emoji:"7️⃣", color:"from-blue-500 to-indigo-600" },
  diamond: { emoji:"💎", color:"from-cyan-400 to-blue-500" },
  chest:   { emoji:"🎁", color:"from-emerald-400 to-teal-600" },
  crown:   { emoji:"👑", color:"from-yellow-300 to-amber-500" },
};

interface SpinResult {
  reels: JpSymbol[][];
  paylines: {lineIndex:number;symbols:JpSymbol[];payout:number}[];
  totalWin: number; profit: number;
  jackpotType: "NONE"|"MINI"|"MAJOR"|"MEGA";
  jackpotWin: number;
  bonusTriggered: boolean;
  bonusPicks: {chestIndex:number;reward:number}[];
  bonusTotal: number;
  multiplier: number; betAmount: number;
}

interface Pool { mini:number; major:number; mega:number; }

const JACKPOT_COLORS = {
  MINI:  "from-emerald-400 to-teal-500",
  MAJOR: "from-blue-500 to-indigo-600",
  MEGA:  "from-yellow-400 via-orange-500 to-red-500",
};

function PoolDisplay({ pool }: { pool: Pool }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["MINI","MAJOR","MEGA"] as const).map((tier) => (
        <motion.div
          key={tier}
          animate={{ scale:[1,1.02,1] }}
          transition={{ duration:2, repeat:Infinity, delay: tier==="MEGA"?0:tier==="MAJOR"?0.6:1.2 }}
          className={`rounded-2xl bg-gradient-to-br ${JACKPOT_COLORS[tier]} p-0.5`}
        >
          <div className="rounded-2xl bg-[#0a0610] px-2 py-2 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">{tier}</p>
            <motion.p
              animate={{ opacity:[0.8,1,0.8] }}
              transition={{ duration:1.5, repeat:Infinity }}
              className="text-sm font-black text-white leading-none mt-0.5"
            >
              ₹{pool[tier.toLowerCase() as "mini"|"major"|"mega"].toLocaleString("en-IN")}
            </motion.p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function BonusModal({ picks, onDone }: { picks:{chestIndex:number;reward:number}[]; onDone:(total:number)=>void }) {
  const [revealed, setRevealed] = useState<number[]>([]);
  const [picksLeft, setPicksLeft] = useState(3);
  const total = revealed.reduce((s, i) => {
    const pick = picks.find((p) => p.chestIndex === i);
    return s + (pick ? pick.reward : 0);
  }, 0);

  function pickChest(i: number) {
    if (revealed.includes(i) || picksLeft === 0) return;
    setRevealed(p => [...p, i]);
    setPicksLeft(p => p - 1);
  }

  useEffect(() => {
    if (picksLeft === 0) {
      setTimeout(() => onDone(total), 1800);
    }
  }, [picksLeft, total, onDone]);

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
    >
      <motion.div
        initial={{scale:0.8,y:40}} animate={{scale:1,y:0}}
        className="w-full max-w-[380px] rounded-[32px] bg-gradient-to-b from-[#1a0633] to-[#0a0610] border border-yellow-500/30 p-6"
      >
        <div className="text-center mb-4">
          <motion.p animate={{scale:[1,1.05,1]}} transition={{duration:1,repeat:Infinity}} className="text-2xl font-black text-yellow-400">🎁 BONUS ROUND!</motion.p>
          <p className="text-sm text-white/50 mt-1">Pick {picksLeft > 0 ? picksLeft : 0} treasure chest{picksLeft !== 1 ? "s" : ""}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({length:9},(_,i) => {
            const isRevealed = revealed.includes(i);
            const pick = picks.find(p => p.chestIndex === i);
            return (
              <motion.button
                key={i} whileTap={!isRevealed && picksLeft>0 ? {scale:0.92} : {}}
                onClick={() => pickChest(i)}
                disabled={isRevealed || picksLeft === 0}
                className={`aspect-square rounded-2xl text-3xl flex items-center justify-center transition-all ${
                  isRevealed
                    ? "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-lg shadow-yellow-500/40"
                    : "bg-white/10 border border-white/20 hover:bg-white/20"
                }`}
              >
                {isRevealed && pick ? (
                  <div className="text-center">
                    <p className="text-xs font-black text-white leading-none">₹{pick.reward}</p>
                  </div>
                ) : "🎁"}
              </motion.button>
            );
          })}
        </div>
        {picksLeft === 0 && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="mt-4 text-center">
            <p className="text-xl font-black text-yellow-400">Bonus: +₹{total.toLocaleString("en-IN")}</p>
            <p className="text-xs text-white/40 mt-1">Collecting…</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

function JackpotSlot() {
  const [betAmount, setBetAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<JpSymbol[][]>([
    ["crown","cherry","lemon"],
    ["seven","bell","chest"],
    ["diamond","seven","cherry"],
  ]);
  const [result, setResult] = useState<SpinResult|null>(null);
  const [pool, setPool] = useState<Pool>({ mini:100, major:500, mega:2000 });
  const [showWin, setShowWin] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [history, setHistory] = useState<{betAmount:number;totalWin:number;jackpotType:string}[]>([]);
  const [jackpotWon, setJackpotWon] = useState<{type:string;amount:number}|null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const { apiRequest: api } = await import("@/lib/api-client");
          const r = await api<{success:boolean;accessToken?:string}>("/auth/firebase-sync",{method:"POST",body:JSON.stringify({idToken})});
          if (r.accessToken) localStorage.setItem("accessToken", r.accessToken);
        } catch {}
      }
    });
    fetchPool();
    return () => unsub();
  }, []);

  async function fetchPool() {
    try {
      const r = await apiRequest<{pool:Pool}>("/jackpot/pool");
      setPool(r.pool);
    } catch {}
  }

  const spin = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return alert("Please login first");
    if (spinning) return;
    setSpinning(true); setResult(null); setShowWin(false); setJackpotWon(null);

    const syms: JpSymbol[] = ["cherry","lemon","bell","seven","diamond","chest","crown"];
    spinIntervalRef.current = setInterval(() => {
      setReels(Array.from({length:3},()=>Array.from({length:3},()=>syms[Math.floor(Math.random()*syms.length)])));
    }, 80);

    try {
      const data = await apiRequest<SpinResult>("/jackpot/spin",{method:"POST",body:JSON.stringify({amount:betAmount}),token});
      setTimeout(() => {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        setReels(data.reels);
        setResult(data);
        setSpinning(false);
        setHistory(p => [{betAmount:data.betAmount,totalWin:data.totalWin,jackpotType:data.jackpotType},...p.slice(0,19)]);
        fetchPool();

        if (data.jackpotType !== "NONE") {
          setJackpotWon({type:data.jackpotType,amount:data.jackpotWin});
          setTimeout(()=> setShowWin(true), 600);
        } else if (data.bonusTriggered) {
          setTimeout(() => setShowBonus(true), 800);
        } else if (data.totalWin > 0) {
          setTimeout(()=> setShowWin(true), 400);
        }
      }, 1200);
    } catch (err:any) {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      setSpinning(false);
      alert(err.message || "Spin failed");
    }
  }, [betAmount, spinning]);

  function handleBonusDone(total:number) {
    setShowBonus(false);
    if (total > 0) setTimeout(()=>setShowWin(true), 400);
  }

  const displayWin = result ? result.totalWin : 0;

  return (
    <main className="min-h-screen bg-[#0a0610] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1a0030] via-[#0a0610] to-[#1a0030] px-4 py-3 shadow-lg shadow-purple-900/40 border-b border-yellow-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/slots" className="grid size-9 place-items-center rounded-full bg-white/10">
                <ArrowLeft size={18}/>
              </Link>
              <div>
                <h1 className="text-lg font-black flex items-center gap-2">
                  <span className="text-2xl">🏆</span> Progressive Jackpot
                </h1>
                <p className="text-[10px] font-bold text-yellow-400/70 uppercase tracking-widest">Mini · Major · Mega</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5">
              <Star size={12} className="text-yellow-400"/>
              <span className="text-xs font-black text-yellow-400">LIVE</span>
            </div>
          </div>
        </header>

        <div className="space-y-3 px-3 pb-28 pt-3">
          {/* Jackpot Pool Display */}
          <section className="rounded-[24px] bg-gradient-to-b from-[#1a0633] to-[#0d0420] border border-yellow-500/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2 text-center">🏆 Global Jackpot Pool</p>
            <PoolDisplay pool={pool}/>
          </section>

          {/* Slot Machine */}
          <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#1a0633] via-[#120425] to-[#0a0610] border-2 border-purple-500/30 shadow-2xl shadow-purple-900/40">
            {/* Top lights */}
            <div className="flex justify-center gap-2 py-2">
              {Array.from({length:11}).map((_,i)=>(
                <motion.div key={i}
                  animate={{opacity:[0.3,1,0.3]}}
                  transition={{duration:0.7,repeat:Infinity,delay:i*0.08}}
                  className="size-2 rounded-full bg-yellow-400"
                />
              ))}
            </div>

            <div className="px-3 pb-4">
              <div className="relative rounded-2xl bg-black/60 border border-white/10 p-2 overflow-hidden">
                {/* Payline */}
                <div className="absolute inset-y-0 left-0 right-0 z-10 pointer-events-none flex items-center">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent"/>
                </div>

                {/* 3x3 Reels */}
                <div className="grid grid-cols-3 gap-2">
                  {reels.map((reel,col)=>(
                    <div key={col} className="space-y-2">
                      {reel.map((sym,row)=>{
                        const cfg = SYM[sym];
                        const isWin = result?.paylines.some(p=>p.payout>0) && !spinning;
                        return (
                          <motion.div
                            key={`${col}-${row}-${sym}`}
                            initial={spinning?{y:-20,opacity:0}:false}
                            animate={{y:0,opacity:1}}
                            transition={{type:"spring",stiffness:300,damping:20,delay:spinning?0:col*0.12}}
                            className={`relative flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br ${cfg.color} shadow-lg ${spinning?"animate-pulse":""} ${isWin?"ring-2 ring-yellow-400/60":""}`}
                          >
                            <span className="text-4xl drop-shadow-lg">{cfg.emoji}</span>
                            {isWin && (
                              <motion.div animate={{opacity:[0,1,0]}} transition={{duration:1,repeat:Infinity}} className="absolute inset-0 rounded-xl border-2 border-yellow-400"/>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Win overlay */}
                <AnimatePresence>
                  {showWin && result && displayWin > 0 && (
                    <motion.div
                      initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}}
                      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl"
                      onClick={()=>setShowWin(false)}
                    >
                      <div className="text-center px-4">
                        {jackpotWon && (
                          <motion.div animate={{scale:[1,1.12,1],rotate:[0,4,-4,0]}} transition={{duration:0.6,repeat:Infinity}} className="mb-2">
                            <p className={`text-xl font-black bg-gradient-to-r ${JACKPOT_COLORS[jackpotWon.type as "MINI"|"MAJOR"|"MEGA"]} bg-clip-text text-transparent uppercase tracking-widest`}>
                              {jackpotWon.type} JACKPOT!
                            </p>
                            <p className="text-4xl">🏆</p>
                          </motion.div>
                        )}
                        <motion.p animate={{scale:[1,1.08,1]}} transition={{duration:0.8,repeat:Infinity}}
                          className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500">
                          +₹{displayWin.toLocaleString("en-IN")}
                        </motion.p>
                        {result.bonusTotal > 0 && <p className="text-sm text-emerald-400 font-bold mt-1">incl. ₹{result.bonusTotal} bonus</p>}
                        <p className="text-xs text-white/30 mt-3">Tap to dismiss</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom lights */}
            <div className="flex justify-center gap-2 py-2">
              {Array.from({length:11}).map((_,i)=>(
                <motion.div key={i}
                  animate={{opacity:[1,0.3,1]}}
                  transition={{duration:0.7,repeat:Infinity,delay:i*0.08}}
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
                {[2,5,10,50,100,200,500].map(v=>(
                  <button key={v} onClick={()=>setBetAmount(v)}
                    className={`rounded-xl py-2.5 text-xs font-black transition ${betAmount===v?"bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg shadow-yellow-500/30":"bg-white/5 text-white/50 border border-white/10"}`}>
                    {v>=1000?`${v/1000}K`:v}
                  </button>
                ))}
              </div>
            </div>

            <motion.button whileTap={spinning?undefined:{scale:0.95}} onClick={spin} disabled={spinning}
              className={`relative w-full rounded-2xl py-5 text-xl font-black text-white shadow-xl transition ${spinning?"bg-gray-700 cursor-not-allowed":"bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 shadow-yellow-500/30"}`}>
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span animate={{rotate:360}} transition={{duration:0.5,repeat:Infinity,ease:"linear"}}>🏆</motion.span>
                  Spinning…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap size={22}/> SPIN · ₹{betAmount.toLocaleString("en-IN")}
                </span>
              )}
            </motion.button>

            {result && !showWin && (
              <div className={`rounded-xl p-3 text-center ${result.totalWin>0?"bg-emerald-500/10 border border-emerald-500/20":"bg-red-500/10 border border-red-500/20"}`}>
                <p className={`text-lg font-black ${result.totalWin>0?"text-emerald-400":"text-red-400"}`}>
                  {result.totalWin>0?`Won ₹${result.totalWin.toLocaleString("en-IN")}`:"No win this spin"}
                </p>
                {result.jackpotType!=="NONE" && <p className="text-xs text-yellow-400 font-bold mt-1">{result.jackpotType} Jackpot! +₹{result.jackpotWin}</p>}
              </div>
            )}
          </section>

          {/* Paytable */}
          <section className="rounded-[28px] bg-[#12081e] border border-purple-500/20 p-4">
            <h2 className="text-base font-black mb-3 flex items-center gap-2"><Trophy size={18} className="text-yellow-400"/> Paytable & Jackpots</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(["cherry","lemon","bell","seven","diamond","crown"] as JpSymbol[]).map(sym=>(
                <div key={sym} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/5 p-2.5">
                  <span className="text-2xl">{SYM[sym].emoji}</span>
                  <div>
                    <p className="text-xs font-black capitalize text-white/80">{sym}</p>
                    <p className="text-[10px] font-bold text-white/40">3x → {({cherry:0.4,lemon:0.6,bell:1.0,seven:3.0,diamond:10,crown:15} as Record<string,number>)[sym]}x</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3">
              <p className="text-xs font-black text-yellow-400 flex items-center gap-1"><Gift size={13}/> 3× Chest = Bonus Pick Round</p>
              <p className="text-[10px] text-white/40 mt-0.5">Choose 3 treasure chests to reveal bonus prizes</p>
            </div>
          </section>

          {/* Recent History */}
          <section className="rounded-[28px] bg-[#12081e] border border-purple-500/20 p-4">
            <h2 className="text-base font-black mb-3 flex items-center gap-2"><Star size={18} className="text-amber-400"/> Recent Spins</h2>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {history.length===0 ? (
                <p className="text-xs font-bold text-white/30 text-center py-4">No spins yet. Hit SPIN to start!</p>
              ) : history.map((h,i)=>(
                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span className="text-xs font-bold text-white/40">₹{h.betAmount}</span>
                  <span className={`text-sm font-black ${h.totalWin>0?"text-emerald-400":"text-red-400"}`}>
                    {h.totalWin>0?`+₹${h.totalWin}`:"-₹"+h.betAmount}
                  </span>
                  {h.jackpotType!=="NONE" && <span className={`text-[10px] rounded-full px-2 py-0.5 font-black bg-gradient-to-r ${JACKPOT_COLORS[h.jackpotType as "MINI"|"MAJOR"|"MEGA"]} text-white`}>{h.jackpotType}</span>}
                </div>
              ))}
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
                  item.href === "/jackpot" ? "bg-yellow-500/20 text-yellow-400" : "text-white/40"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Bonus Modal */}
        <AnimatePresence>
          {showBonus && result?.bonusPicks && (
            <BonusModal picks={result.bonusPicks} onDone={handleBonusDone}/>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
