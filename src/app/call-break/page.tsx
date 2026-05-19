"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Star, Sword } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";

type Suit = "♠" | "♥" | "♦" | "♣";

interface Card {
  suit: Suit;
  value: string;
  id: string;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const TRUMP_SUIT: Suit = "♠";

const BOTS = [
  { name: "DeepPlayer", avatar: "🧠", rank: "Gold", bid: 3 },
  { name: "TrumpKing", avatar: "♠️", rank: "Platinum", bid: 4 },
  { name: "AceBreaker", avatar: "🎯", rank: "Silver", bid: 2 },
];

function randomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const value = VALUES[Math.floor(Math.random() * VALUES.length)];
  return { suit, value, id: `${suit}${value}${Math.random()}` };
}

function dealHand(n: number): Card[] {
  return Array.from({ length: n }, randomCard);
}

function cardStrength(card: Card): number {
  const rank = VALUES.indexOf(card.value);
  const trumpBonus = card.suit === TRUMP_SUIT ? 20 : 0;
  return rank + trumpBonus;
}

function isRed(suit: Suit) {
  return suit === "♥" || suit === "♦";
}

export default function CallBreakPage() {
  const [entryFee, setEntryFee] = useState(10);
  const [balance, setBalance] = useState(500);
  const [phase, setPhase] = useState<"lobby" | "bid" | "playing" | "result">("lobby");
  const [hand, setHand] = useState<Card[]>([]);
  const [myBid, setMyBid] = useState(3);
  const [currentTrick, setCurrentTrick] = useState<Card[]>([]);
  const [trickWins, setTrickWins] = useState(0);
  const [botTrickWins] = useState(BOTS.map(() => Math.floor(Math.random() * 4)));
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState<Array<{ player: string; score: number }>>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [lastTrickWinner, setLastTrickWinner] = useState<string | null>(null);
  const [winnings, setWinnings] = useState(0);

  const joinGame = useCallback(() => {
    if (balance < entryFee) return;
    setBalance((b) => b - entryFee);
    setHand(dealHand(13));
    setPhase("bid");
  }, [balance, entryFee]);

  const confirmBid = useCallback(() => {
    setPhase("playing");
    setTrickWins(0);
    setCurrentTrick([]);
  }, []);

  const playCard = useCallback((card: Card) => {
    setCurrentTrick((prev) => {
      const newTrick = [...prev, card];
      setHand((h) => h.filter((c) => c.id !== card.id));
      setSelectedCard(null);

      // Simulate bot plays
      const botPlays = BOTS.map(() => randomCard());
      const allCards = [card, ...botPlays];
      const winnerIdx = allCards.reduce((best, c, i) => cardStrength(c) > cardStrength(allCards[best]) ? i : best, 0);

      setTimeout(() => {
        setCurrentTrick([]);
        if (winnerIdx === 0) {
          setTrickWins((w) => w + 1);
          setLastTrickWinner("You");
        } else {
          setLastTrickWinner(BOTS[winnerIdx - 1].name);
        }
      }, 800);

      return [...newTrick, ...botPlays];
    });
  }, []);

  const endGame = useCallback(() => {
    const won = trickWins >= myBid;
    const prize = won ? entryFee * 2.5 : 0;
    if (won) setBalance((b) => b + Math.round(prize));
    setWinnings(Math.round(prize));
    const sc = [
      { player: "You", score: trickWins >= myBid ? trickWins * 10 : -myBid * 5 },
      ...BOTS.map((b, i) => ({ player: b.name, score: (botTrickWins[i] >= b.bid ? botTrickWins[i] * 10 : -b.bid * 5) })),
    ];
    setScores(sc);
    setPhase("result");
  }, [trickWins, myBid, entryFee, botTrickWins]);

  const reset = useCallback(() => {
    setPhase("lobby");
    setHand([]);
    setCurrentTrick([]);
    setTrickWins(0);
    setRound((r) => r + 1);
  }, []);

  return (
    <main className="min-h-screen bg-[#08051a] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#0a062a] via-[#1a1050] to-[#0a062a] px-4 py-3 shadow-lg border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <Sword size={18} className="text-indigo-400" /> Call Break
              </h1>
              <p className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">Spades Trump · 4-Player</p>
            </div>
          </div>
          <div className="rounded-xl bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 text-right">
            <p className="text-[10px] text-indigo-400/60 font-bold">Balance</p>
            <p className="text-sm font-black text-indigo-300">₹{balance.toLocaleString("en-IN")}</p>
          </div>
        </header>

        <div className="space-y-4 px-3 pb-28 pt-3">
          {/* Lobby */}
          {phase === "lobby" && (
            <>
              {/* Players */}
              <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-br from-[#0a062a] to-[#08051a] border border-indigo-500/20 p-4">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(99,102,241,0.08),transparent)]" />
                <h3 className="text-sm font-black text-indigo-400 mb-4 flex items-center gap-2 relative">
                  <Trophy size={14} /> Table #42 · Round {round}
                </h3>
                <div className="relative grid grid-cols-2 gap-3">
                  {/* Player placeholder */}
                  <div className="rounded-2xl bg-indigo-500/20 border border-indigo-500/30 p-3 text-center">
                    <p className="text-2xl">🎮</p>
                    <p className="text-xs font-black text-indigo-300 mt-1">You</p>
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-300 rounded-full px-2 py-0.5">Ready</span>
                  </div>
                  {BOTS.map((bot, i) => (
                    <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                      <p className="text-2xl">{bot.avatar}</p>
                      <p className="text-xs font-black text-white/70 mt-1">{bot.name}</p>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 ${bot.rank === "Platinum" ? "bg-purple-500/20 text-purple-400" : bot.rank === "Gold" ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-500/20 text-slate-400"}`}>
                        {bot.rank}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="relative mt-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3">
                  <p className="text-xs font-bold text-indigo-400/60">Trump Suit:</p>
                  <p className="text-3xl font-black text-indigo-300">{TRUMP_SUIT} Spades</p>
                </div>
              </div>

              {/* Entry Fee */}
              <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/20 p-4">
                <p className="text-xs font-black text-indigo-400/60 uppercase tracking-widest mb-2">Entry Fee (₹)</p>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 25, 50, 100].map((v) => (
                    <button
                      key={v}
                      onClick={() => setEntryFee(v)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                        entryFee === v
                          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg"
                          : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}
                    >
                      ₹{v}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={joinGame}
                disabled={balance < entryFee}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 py-4 text-lg font-black text-white shadow-xl shadow-indigo-500/30 disabled:opacity-50"
              >
                <Sword size={20} className="inline mr-2" />
                Join Table · ₹{entryFee}
              </motion.button>

              {/* Leaderboard teaser */}
              <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/20 p-4">
                <h3 className="text-sm font-black text-indigo-400 mb-3">🏆 Season Leaderboard</h3>
                {[
                  { name: "TrumpGod", wins: 234, rank: 1 },
                  { name: "AceKing99", wins: 198, rank: 2 },
                  { name: "You", wins: round - 1, rank: 47 },
                ].map((p, i) => (
                  <div key={i} className={`flex items-center justify-between py-2 border-b border-white/5 last:border-0 ${p.name === "You" ? "text-indigo-400" : "text-white/60"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black w-5 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : "text-white/30"}`}>
                        {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : `#${p.rank}`}
                      </span>
                      <span className="text-sm font-bold">{p.name}</span>
                    </div>
                    <span className="text-xs font-black">{p.wins} wins</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bidding Phase */}
          {phase === "bid" && (
            <>
              <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/30 p-4 text-center">
                <p className="text-xs font-black text-indigo-400/60 uppercase tracking-widest mb-4">Make Your Bid</p>
                <p className="text-sm text-white/50 mb-4">How many tricks will you win?</p>

                {/* Bot bids */}
                <div className="flex justify-around mb-6">
                  {BOTS.map((bot, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xl">{bot.avatar}</p>
                      <p className="text-[10px] text-white/40">{bot.name}</p>
                      <p className="text-lg font-black text-indigo-400">Bid: {bot.bid}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setMyBid((b) => Math.max(1, b - 1))}
                    className="w-12 h-12 rounded-full bg-indigo-500/20 text-2xl font-black text-indigo-400 border border-indigo-500/30"
                  >
                    −
                  </button>
                  <motion.p
                    key={myBid}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="text-7xl font-black text-indigo-300"
                  >
                    {myBid}
                  </motion.p>
                  <button
                    onClick={() => setMyBid((b) => Math.min(13, b + 1))}
                    className="w-12 h-12 rounded-full bg-indigo-500/20 text-2xl font-black text-indigo-400 border border-indigo-500/30"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-white/30 mt-2">You bid to win at least {myBid} tricks</p>
              </div>

              {/* Preview hand */}
              <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/20 p-3">
                <p className="text-xs font-black text-indigo-400/60 uppercase tracking-widest mb-2">Your Cards</p>
                <div className="flex flex-wrap gap-1.5">
                  {hand.slice(0, 7).map((card) => (
                    <div key={card.id} className="rounded-lg bg-white px-2 py-1.5 flex flex-col items-center">
                      <span className={`text-[10px] font-black leading-none ${isRed(card.suit) ? "text-red-500" : "text-slate-800"}`}>{card.value}</span>
                      <span className={`text-sm leading-none ${isRed(card.suit) ? "text-red-500" : "text-slate-800"}`}>{card.suit}</span>
                    </div>
                  ))}
                  {hand.length > 7 && <span className="text-xs text-white/30 self-center">+{hand.length - 7} more</span>}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmBid}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-4 text-lg font-black text-white shadow-xl shadow-indigo-500/30"
              >
                Confirm Bid: {myBid} Tricks
              </motion.button>
            </>
          )}

          {/* Playing Phase */}
          {phase === "playing" && (
            <>
              {/* Score bar */}
              <div className="rounded-2xl bg-[#0a062a] border border-indigo-500/20 p-3 flex items-center justify-between">
                <div className="text-center">
                  <p className="text-[10px] text-white/40">Your Bid</p>
                  <p className="text-2xl font-black text-indigo-400">{myBid}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/40">Wins</p>
                  <p className="text-2xl font-black text-emerald-400">{trickWins}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/40">Left</p>
                  <p className="text-2xl font-black text-white/60">{hand.length}</p>
                </div>
              </div>

              {/* Current trick table */}
              {currentTrick.length > 0 && (
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3">
                  <p className="text-[10px] font-black text-indigo-400/60 mb-2">Current Trick</p>
                  <div className="flex gap-2 justify-center">
                    {currentTrick.map((c, i) => (
                      <div key={i} className="rounded-lg bg-white w-10 h-14 flex flex-col items-center justify-center">
                        <span className={`text-[10px] font-black ${isRed(c.suit) ? "text-red-500" : "text-slate-800"}`}>{c.value}</span>
                        <span className={`text-sm ${isRed(c.suit) ? "text-red-500" : "text-slate-800"}`}>{c.suit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastTrickWinner && (
                <p className="text-center text-xs font-bold text-indigo-400/60">
                  Last trick won by: <span className="text-indigo-300">{lastTrickWinner}</span>
                </p>
              )}

              {/* Hand */}
              <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/20 p-3">
                <p className="text-xs font-black text-indigo-400/60 uppercase tracking-widest mb-2">Play a Card</p>
                <div className="flex flex-wrap gap-1.5">
                  {hand.map((card) => (
                    <motion.button
                      key={card.id}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setSelectedCard(card);
                        playCard(card);
                      }}
                      className={`rounded-lg bg-white px-2 py-1.5 flex flex-col items-center transition ${
                        selectedCard?.id === card.id ? "ring-2 ring-indigo-400 -translate-y-2" : ""
                      } ${card.suit === TRUMP_SUIT ? "ring-1 ring-indigo-400/30" : ""}`}
                    >
                      <span className={`text-[10px] font-black leading-none ${isRed(card.suit) ? "text-red-500" : "text-slate-800"}`}>{card.value}</span>
                      <span className={`text-sm leading-none ${isRed(card.suit) ? "text-red-500" : "text-slate-800"}`}>{card.suit}</span>
                      {card.suit === TRUMP_SUIT && <span className="text-[6px] text-indigo-600 font-black">TRUMP</span>}
                    </motion.button>
                  ))}
                </div>
              </div>

              {hand.length === 0 && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={endGame}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-4 text-lg font-black text-white shadow-xl shadow-indigo-500/30"
                >
                  <Trophy size={20} className="inline mr-2" />
                  End Round & See Results
                </motion.button>
              )}
            </>
          )}

          {/* Result Phase */}
          {phase === "result" && (
            <div className="space-y-4">
              <div className={`rounded-[24px] p-6 text-center ${winnings > 0 ? "bg-gradient-to-br from-emerald-900/80 to-green-800/80 border border-emerald-500/30" : "bg-gradient-to-br from-red-900/80 to-rose-800/80 border border-red-500/30"}`}>
                <p className="text-5xl mb-2">{winnings > 0 ? "⚔️🏆" : "😤"}</p>
                <p className="text-2xl font-black">{winnings > 0 ? "BID MADE!" : "BID FAILED"}</p>
                <p className="text-sm text-white/60 mt-1">You bid {myBid}, won {trickWins} tricks</p>
                {winnings > 0 ? (
                  <p className="text-2xl font-black text-emerald-400 mt-1">+₹{winnings.toLocaleString("en-IN")}</p>
                ) : (
                  <p className="text-sm text-red-400 mt-1">-{myBid * 5} points</p>
                )}
              </div>

              {scores.length > 0 && (
                <div className="rounded-[24px] bg-[#0a062a] border border-indigo-500/20 p-4">
                  <h3 className="text-sm font-black text-indigo-400 mb-3">📊 Score Card</h3>
                  {scores.sort((a, b) => b.score - a.score).map((s, i) => (
                    <div key={i} className={`flex items-center justify-between py-2 border-b border-white/5 last:border-0 ${s.player === "You" ? "text-indigo-400" : "text-white/60"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white/30">#{i + 1}</span>
                        <span className="text-sm font-bold">{s.player}</span>
                        {s.player === "You" && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 rounded px-1">You</span>}
                      </div>
                      <span className={`text-xs font-black ${s.score >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.score >= 0 ? "+" : ""}{s.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 py-4 text-lg font-black text-white shadow-xl shadow-indigo-500/30"
              >
                Play Again
              </motion.button>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-indigo-500/10 bg-[#08051a]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🏠", label: "Home", href: "/" },
              { icon: "👑", label: "Teen Patti", href: "/teen-patti" },
              { icon: "⚔️", label: "Call Break", href: "/call-break" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
                  item.href === "/call-break" ? "bg-indigo-500/20 text-indigo-400" : "text-white/40"
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
