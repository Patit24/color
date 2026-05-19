"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Star, Users, Target } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";

type RummyMode = "Points" | "Deals" | "Pool";
type CardSuit = "♠" | "♥" | "♦" | "♣";

interface Card {
  suit: CardSuit;
  value: string;
  id: string;
}

const SUITS: CardSuit[] = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const MODES: RummyMode[] = ["Points", "Deals", "Pool"];

const BOTS = [
  { name: "Priya_R", score: 24, avatar: "👩" },
  { name: "ArjunAce", score: 18, avatar: "🧔" },
  { name: "KingRummy", score: 31, avatar: "👑" },
];

function newDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      cards.push({ suit, value, id: `${suit}${value}` });
    }
  }
  return cards.sort(() => Math.random() - 0.5);
}

function dealCards(n: number): Card[] {
  return newDeck().slice(0, n);
}

function cardColor(suit: CardSuit) {
  return suit === "♥" || suit === "♦" ? "text-red-500" : "text-slate-800";
}

function simulateRummyScore(): number {
  return Math.floor(Math.random() * 50);
}

export default function RummyPage() {
  const [mode, setMode] = useState<RummyMode>("Points");
  const [entryFee, setEntryFee] = useState(10);
  const [balance, setBalance] = useState(500);
  const [phase, setPhase] = useState<"lobby" | "playing" | "result">("lobby");
  const [hand, setHand] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [declaredGroups, setDeclaredGroups] = useState<Card[][]>([]);
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  const [deckCard, setDeckCard] = useState<Card | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [botScores] = useState(BOTS.map((b) => ({ ...b, score: simulateRummyScore() })));
  const [round, setRound] = useState(1);
  const [winnings, setWinnings] = useState(0);
  const [showMission, setShowMission] = useState(false);

  const joinGame = useCallback(() => {
    if (balance < entryFee) return;
    setBalance((b) => b - entryFee);
    const dealt = dealCards(13);
    setHand(dealt);
    setDiscardPile([dealCards(1)[0]]);
    setDeckCard(dealCards(1)[0]);
    setPhase("playing");
    setSelectedCards(new Set());
    setDeclaredGroups([]);
  }, [balance, entryFee]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const drawFromDeck = useCallback(() => {
    const newCard = dealCards(1)[0];
    setHand((h) => [...h, newCard]);
  }, []);

  const pickFromDiscard = useCallback(() => {
    if (!discardPile.length) return;
    const top = discardPile[discardPile.length - 1];
    setHand((h) => [...h, top]);
    setDiscardPile((d) => d.slice(0, -1));
  }, [discardPile]);

  const discardSelected = useCallback(() => {
    if (selectedCards.size !== 1) return;
    const id = Array.from(selectedCards)[0];
    const card = hand.find((c) => c.id === id);
    if (!card) return;
    setHand((h) => h.filter((c) => c.id !== id));
    setDiscardPile((d) => [...d, card]);
    setSelectedCards(new Set());
  }, [selectedCards, hand]);

  const groupSelected = useCallback(() => {
    const cards = hand.filter((c) => selectedCards.has(c.id));
    if (cards.length < 3) return;
    setDeclaredGroups((g) => [...g, cards]);
    setHand((h) => h.filter((c) => !selectedCards.has(c.id)));
    setSelectedCards(new Set());
  }, [hand, selectedCards]);

  const declare = useCallback(() => {
    // Simulate win/loss
    const won = Math.random() > 0.4;
    const prize = won ? entryFee * 3 : 0;
    const sc = won ? 0 : Math.floor(Math.random() * 30) + 5;
    setMyScore(sc);
    setWinnings(prize);
    if (won) setBalance((b) => b + prize);
    setPhase("result");
  }, [entryFee]);

  const reset = useCallback(() => {
    setPhase("lobby");
    setHand([]);
    setSelectedCards(new Set());
    setDeclaredGroups([]);
    setDiscardPile([]);
    setRound((r) => r + 1);
  }, []);

  return (
    <main className="min-h-screen bg-[#061215] text-white">
      <div className="mx-auto min-h-screen w-full max-w-[430px]">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-[#031509] via-[#064015] to-[#031509] px-4 py-3 shadow-lg border-b border-emerald-500/20">
          <div className="flex items-center gap-3">
            <Link href="/" className="grid size-9 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black flex items-center gap-2">
                <span className="text-xl">🃏</span> Indian Rummy
              </h1>
              <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Skill-Based · Real Money</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMission(!showMission)} className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-2 py-1.5">
              <Target size={14} className="text-emerald-400" />
            </button>
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-right">
              <p className="text-[10px] text-emerald-400/60 font-bold">Balance</p>
              <p className="text-sm font-black text-emerald-300">₹{balance.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pb-28 pt-3">
          {/* Mission Panel */}
          <AnimatePresence>
            {showMission && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="rounded-[24px] bg-[#031509] border border-emerald-500/20 p-4 overflow-hidden"
              >
                <h3 className="text-sm font-black text-emerald-400 mb-3">🎯 Daily Missions</h3>
                {[
                  { label: "Win 3 games", progress: 1, total: 3, reward: "₹50" },
                  { label: "Play 10 rounds", progress: round, total: 10, reward: "₹100" },
                  { label: "Declare without drop", progress: 0, total: 1, reward: "₹25" },
                ].map((m, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-white/60">{m.label}</span>
                      <span className="text-xs font-black text-emerald-400">{m.reward}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                        style={{ width: `${Math.min(100, (m.progress / m.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">{m.progress}/{m.total}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "lobby" && (
            <>
              {/* Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-2xl py-3 text-sm font-black transition ${
                      mode === m
                        ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Entry Fee */}
              <div className="rounded-[24px] bg-[#031509] border border-emerald-500/20 p-4">
                <p className="text-xs font-black text-emerald-400/60 uppercase tracking-widest mb-2">Entry Fee (₹)</p>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 25, 50, 100, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => setEntryFee(v)}
                      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                        entryFee === v
                          ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      ₹{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players in Lobby */}
              <div className="rounded-[24px] bg-[#031509] border border-emerald-500/20 p-4">
                <h3 className="text-sm font-black text-emerald-400 mb-3 flex items-center gap-2">
                  <Users size={14} /> Players at Table
                </h3>
                {BOTS.map((bot, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{bot.avatar}</span>
                      <span className="text-sm font-bold">{bot.name}</span>
                    </div>
                    <span className="text-xs font-black text-emerald-400">
                      {botScores[i].score} pts
                    </span>
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={joinGame}
                disabled={balance < entryFee}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 py-4 text-lg font-black text-white shadow-xl shadow-emerald-500/30 disabled:opacity-50"
              >
                <Trophy size={20} className="inline mr-2" />
                Join Game · ₹{entryFee} Entry
              </motion.button>
            </>
          )}

          {phase === "playing" && (
            <>
              {/* Deck & Discard */}
              <div className="flex gap-4 justify-center">
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-1">Deck</p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={drawFromDeck}
                    className="w-14 h-20 rounded-xl bg-gradient-to-br from-emerald-800/60 to-green-900/60 border-2 border-emerald-500/30 flex items-center justify-center text-2xl shadow-lg"
                  >
                    🂠
                  </motion.button>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-white/40 mb-1">Discard</p>
                  {discardPile.length > 0 ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={pickFromDiscard}
                      className="w-14 h-20 rounded-xl bg-white border-2 border-emerald-400 flex flex-col items-center justify-center shadow-lg"
                    >
                      <span className={`text-sm font-black ${cardColor(discardPile[discardPile.length - 1].suit)}`}>
                        {discardPile[discardPile.length - 1].value}
                      </span>
                      <span className={`text-2xl ${cardColor(discardPile[discardPile.length - 1].suit)}`}>
                        {discardPile[discardPile.length - 1].suit}
                      </span>
                    </motion.button>
                  ) : (
                    <div className="w-14 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 text-xs">Empty</div>
                  )}
                </div>
              </div>

              {/* Declared Groups */}
              {declaredGroups.length > 0 && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest mb-2">Declared Groups</p>
                  {declaredGroups.map((group, gi) => (
                    <div key={gi} className="flex gap-1 mb-1">
                      {group.map((c) => (
                        <span key={c.id} className={`text-xs font-black ${cardColor(c.suit)}`}>{c.value}{c.suit}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Hand */}
              <div className="rounded-[24px] bg-[#031509] border border-emerald-500/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black text-emerald-400/60 uppercase tracking-widest">Your Hand ({hand.length} cards)</p>
                  <p className="text-[10px] text-white/30">Tap to select</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hand.map((card) => (
                    <motion.button
                      key={card.id}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleSelect(card.id)}
                      className={`rounded-lg bg-white px-2 py-1.5 flex flex-col items-center transition ${
                        selectedCards.has(card.id) ? "ring-2 ring-emerald-400 -translate-y-2 shadow-lg shadow-emerald-400/30" : ""
                      }`}
                    >
                      <span className={`text-[10px] font-black leading-none ${cardColor(card.suit)}`}>{card.value}</span>
                      <span className={`text-base leading-none ${cardColor(card.suit)}`}>{card.suit}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={discardSelected}
                  disabled={selectedCards.size !== 1}
                  className="rounded-xl py-3 text-xs font-black bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-30"
                >
                  Discard
                </button>
                <button
                  onClick={groupSelected}
                  disabled={selectedCards.size < 3}
                  className="rounded-xl py-3 text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-30"
                >
                  Group
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={declare}
                  className="rounded-xl py-3 text-xs font-black bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30"
                >
                  Declare!
                </motion.button>
              </div>

              <button
                onClick={() => { setPhase("result"); setMyScore(Math.floor(Math.random() * 40) + 20); setWinnings(0); }}
                className="w-full rounded-xl py-3 text-xs font-black text-red-400/60 border border-red-500/10"
              >
                Drop (–{mode === "Pool" ? "20" : "25"} pts)
              </button>
            </>
          )}

          {phase === "result" && (
            <div className="space-y-4">
              <div className={`rounded-[24px] p-6 text-center ${winnings > 0 ? "bg-gradient-to-br from-emerald-900/80 to-green-800/80 border border-emerald-500/30" : "bg-gradient-to-br from-red-900/80 to-rose-800/80 border border-red-500/30"}`}>
                <p className="text-5xl mb-2">{winnings > 0 ? "🏆" : "📋"}</p>
                <p className="text-2xl font-black">{winnings > 0 ? "YOU WIN!" : "Round Over"}</p>
                {winnings > 0 ? (
                  <p className="text-2xl font-black text-emerald-400 mt-1">+₹{winnings.toLocaleString("en-IN")}</p>
                ) : (
                  <p className="text-lg font-bold text-white/60 mt-1">Score: {myScore} pts</p>
                )}
              </div>

              {/* Leaderboard */}
              <div className="rounded-[24px] bg-[#031509] border border-emerald-500/20 p-4">
                <h3 className="text-sm font-black text-emerald-400 mb-3">🏅 Score Card</h3>
                {[
                  { name: "You", score: myScore, isMe: true },
                  ...botScores.map((b) => ({ name: b.name, score: b.score, isMe: false })),
                ]
                  .sort((a, b) => a.score - b.score)
                  .map((p, i) => (
                    <div key={i} className={`flex items-center justify-between py-2 border-b border-white/5 last:border-0 ${p.isMe ? "text-emerald-400" : "text-white/60"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black ${i === 0 ? "text-yellow-400" : "text-white/30"}`}>#{i + 1}</span>
                        <span className="text-sm font-bold">{p.name}</span>
                        {p.isMe && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">You</span>}
                      </div>
                      <span className="text-xs font-black">{p.score} pts</span>
                    </div>
                  ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-lg font-black text-white shadow-xl shadow-emerald-500/30"
              >
                Play Again
              </motion.button>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-emerald-500/10 bg-[#061215]/95 px-4 pb-4 pt-2 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: "🏠", label: "Home", href: "/" },
              { icon: "👑", label: "Teen Patti", href: "/teen-patti" },
              { icon: "🃏", label: "Rummy", href: "/rummy" },
              { icon: "👤", label: "Profile", href: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`grid place-items-center gap-1 rounded-2xl py-2 text-xs font-black ${
                  item.href === "/rummy" ? "bg-emerald-500/20 text-emerald-400" : "text-white/40"
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
