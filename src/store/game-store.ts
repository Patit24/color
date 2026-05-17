"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { doc, onSnapshot, query, collection, orderBy, limit, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions } from "@/lib/firebase";
import {
  type BackendGameMode,
  type BetTarget,
  type GameMode,
  type GameResult,
  type UserBet,
  gameTabs,
  getResultColors,
  secondsForMode,
  targetLabel,
  toBackendGameMode,
} from "@/lib/game";

type Toast = {
  id: string;
  title: string;
  message: string;
  tone: "win" | "loss" | "info";
};

type BackendRound = {
  _id: string;
  gameMode: BackendGameMode;
  period: string;
  status: string;
  resultNumber?: number;
  resultColor?: "RED" | "GREEN" | "VIOLET";
  resultColors?: Array<"RED" | "GREEN" | "VIOLET">;
  resultSize?: "BIG" | "SMALL";
};

type TransactionRow = {
  _id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
};

type BackendWallet = {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
  referralBalance: number;
};

type GameState = {
  balance: number;
  winBalance: number;
  ledger: TransactionRow[];
  realtimeStatus: "connecting" | "live" | "offline";
  activeTab: GameMode;
  period: string;
  secondsLeft: number;
  selectedTarget: BetTarget;
  multiplier: number;
  baseStake: number;
  onlineUsers: number;
  bonusOpen: boolean;
  history: GameResult[];
  myHistory: UserBet[];
  notifications: Toast[];
  setActiveTab: (tab: GameMode) => void;
  setRealtimeStatus: (status: GameState["realtimeStatus"]) => void;
  setOnlineUsers: (count: number) => void;
  setSelectedTarget: (target: BetTarget) => void;
  setMultiplier: (multiplier: number) => void;
  placeBet: () => Promise<void>;
  syncWallet: () => Promise<void>;
  syncHistory: () => Promise<void>;
  applyRoundStarted: (payload: { gameMode: BackendGameMode; period: string; duration: number }) => void;
  applyCountdown: (payload: { gameMode: BackendGameMode; period: string; remaining: number }) => void;
  applyResult: (payload: {
    period: string;
    resultNumber: number;
    resultColor: "RED" | "GREEN" | "VIOLET";
    resultColors?: Array<"RED" | "GREEN" | "VIOLET">;
    resultSize: "BIG" | "SMALL";
  }) => void;
  claimBonus: () => void;
  clearNotification: (id: string) => void;
  tick: () => void;
  setSecondsLeft: (seconds: number) => void;
  syncData: () => () => void;
};

function notify(title: string, message: string, tone: Toast["tone"]): Toast {
  return { id: crypto.randomUUID(), title, message, tone };
}

function targetToApi(target: BetTarget) {
  if (target === "big" || target === "small") {
    return { targetType: "SIZE", targetValue: target.toUpperCase() };
  }

  if (target.startsWith("number-")) {
    return { targetType: "NUMBER", targetValue: target.replace("number-", "") };
  }

  return { targetType: "COLOR", targetValue: target.toUpperCase() };
}

function normalizeRound(round: BackendRound): GameResult | null {
  if (typeof round.resultNumber !== "number") return null;
  const colors = normalizeColors(round.resultColors, round.resultNumber);
  return {
    period: round.period,
    number: round.resultNumber,
    color:
      round.resultColor === "GREEN"
        ? "Green"
        : round.resultColor === "VIOLET"
          ? "Violet"
          : "Red",
    colors,
    size: round.resultSize === "BIG" ? "Big" : "Small",
  };
}

function normalizeColors(colors: BackendRound["resultColors"], number: number): GameResult["colors"] {
  if (!colors?.length) return getResultColors(number);
  return colors.map((color) => {
    if (color === "GREEN") return "Green";
    if (color === "VIOLET") return "Violet";
    return "Red";
  });
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      balance: 0,
      winBalance: 0,
      ledger: [],
      realtimeStatus: "connecting",
      activeTab: gameTabs[1],
      period: "Initializing...",
      secondsLeft: 0,
      selectedTarget: "green",
      multiplier: 1,
      baseStake: 10,
      onlineUsers: 0,
      bonusOpen: false,
      history: [],
      myHistory: [],
      notifications: [],
      setActiveTab: (activeTab) =>
        set({
          activeTab,
          secondsLeft: secondsForMode(activeTab),
          period: "Joining live round",
        }),
      setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),
      setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
      setSelectedTarget: (selectedTarget) => set({ selectedTarget }),
      setMultiplier: (multiplier) => set({ multiplier }),
      clearNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((item) => item.id !== id),
        })),
      claimBonus: () =>
        set((state) => ({
          notifications: [
            notify("Bonus System", "Daily rewards are managed via Cloud Functions in production.", "info"),
            ...state.notifications,
          ],
        })),
      syncData: () => {
        let activeUnsubscribe: (() => void) | null = null;

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
          // Tear down existing listeners if any
          if (activeUnsubscribe) {
            activeUnsubscribe();
            activeUnsubscribe = null;
          }

          if (!user) {
            // Guest or non-logged-in mode: Sync only public live game round and game history
            const unsubGame = onSnapshot(doc(db, "games", "win-go-1m", "live", "current"), (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                const start = data.startTime?.toDate().getTime() || Date.now();
                const now = Date.now();
                const elapsed = Math.floor((now - start) / 1000);
                const remaining = Math.max(0, 60 - elapsed);
                
                set({ 
                  period: data.period,
                  secondsLeft: remaining,
                  realtimeStatus: "live"
                });
              } else {
                console.warn("Live round document missing. Waiting for engine...");
                set({ period: "Waiting for engine...", realtimeStatus: "connecting" });
              }
            }, (error) => {
              console.error("Firestore Round Sync Error:", error);
              set({ realtimeStatus: "offline" });
            });

            const unsubHistory = onSnapshot(
              query(collection(db, "games", "win-go-1m", "history"), orderBy("settledAt", "desc"), limit(40)),
              (snap) => {
                const history = snap.docs.map(doc => {
                  const data = doc.data();
                  return {
                    ...data,
                    colors: data.colors || getResultColors(data.number)
                  } as GameResult;
                });
                set({ history });
              }
            );

            activeUnsubscribe = () => {
              unsubGame();
              unsubHistory();
            };
            return;
          }

          // Logged-in mode: Sync wallet, live round, game history, transactions, and my bets
          const unsubWallet = onSnapshot(doc(db, "wallets", user.uid), (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              set({ 
                balance: data.depositBalance || 0,
                winBalance: data.winningBalance || 0 
              });
            }
          });

          const unsubGame = onSnapshot(doc(db, "games", "win-go-1m", "live", "current"), (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const start = data.startTime?.toDate().getTime() || Date.now();
              const now = Date.now();
              const elapsed = Math.floor((now - start) / 1000);
              const remaining = Math.max(0, 60 - elapsed);
              
              set({ 
                period: data.period,
                secondsLeft: remaining,
                realtimeStatus: "live"
              });
            } else {
              console.warn("Live round document missing. Waiting for engine...");
              set({ period: "Waiting for engine...", realtimeStatus: "connecting" });
            }
          }, (error) => {
            console.error("Firestore Round Sync Error:", error);
            set({ realtimeStatus: "offline" });
          });

          const unsubHistory = onSnapshot(
            query(collection(db, "games", "win-go-1m", "history"), orderBy("settledAt", "desc"), limit(40)),
            (snap) => {
              const history = snap.docs.map(doc => {
                const data = doc.data();
                return {
                  ...data,
                  colors: data.colors || getResultColors(data.number)
                } as GameResult;
              });
              set({ history });
            }
          );

          const unsubLedger = onSnapshot(
            query(collection(db, "transactions"), where("userId", "==", user.uid), limit(20)),
            (snap) => {
              const ledger = snap.docs.map(doc => ({ _id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toMillis() || Date.now() }));
              ledger.sort((a, b) => b.createdAt - a.createdAt);
              set({ ledger: ledger as any[] });
            },
            (error) => {
              console.warn("Transactions Index building or failed:", error.message);
            }
          );

          const unsubMyBets = onSnapshot(
            query(collection(db, "bets"), where("userId", "==", user.uid), limit(40)),
            (snap) => {
              const bets = snap.docs.map((doc) => {
                const data = doc.data();
                return {
                  id: doc.id,
                  period: data.period,
                  target: data.targetValue || data.targetType || data.selection,
                  amount: data.amount,
                  status: (data.status === "WON" || data.status === "WIN") ? "Won" : (data.status === "LOST" || data.status === "LOSS") ? "Lost" : "Pending",
                  profit: data.winAmount || data.profit || 0,
                  createdAt: data.createdAt?.toMillis() || Date.now(),
                } as UserBet & { createdAt: number };
              });

              bets.sort((a, b) => b.createdAt - a.createdAt);

              set((state) => {
                const prevBets = state.myHistory;
                let newNotifications = [...state.notifications];
                
                bets.forEach((newBet) => {
                  const prevBet = prevBets.find((b) => b.id === newBet.id);
                  if (prevBet && prevBet.status === "Pending" && newBet.status !== "Pending") {
                    if (newBet.status === "Won") {
                      newNotifications = [notify("Bet Won! 🎉", `You won ₹${newBet.profit}`, "win"), ...newNotifications];
                    } else if (newBet.status === "Lost") {
                      newNotifications = [notify("Bet Lost 😢", `You lost your bet`, "loss"), ...newNotifications];
                    }
                  }
                });

                return { myHistory: bets, notifications: newNotifications };
              });
            },
            (error) => console.warn("My Bets sync failed:", error.message)
          );

          activeUnsubscribe = () => {
            unsubWallet();
            unsubGame();
            unsubHistory();
            unsubLedger();
            unsubMyBets();
          };
        });

        return () => {
          unsubscribeAuth();
          if (activeUnsubscribe) {
            activeUnsubscribe();
          }
        };
      },
      syncHistory: async () => {}, 
      syncWallet: async () => {}, 
      placeBet: async () => {
        const state = get();
        const amount = state.baseStake * state.multiplier;

        if (state.realtimeStatus !== "live" || state.secondsLeft <= 5 || !state.period) {
          set((current) => ({
            notifications: [
              notify("Bet unavailable", "Round is locked or syncing.", "loss"),
              ...current.notifications,
            ],
          }));
          return;
        }

        try {
          const placeBetFn = httpsCallable(functions, "placeBet");
          await placeBetFn({
            mode: "win-go-1m",
            selection: state.selectedTarget,
            amount,
          });

          set((current) => ({
            notifications: [
              notify("Bet accepted", `${targetLabel(current.selectedTarget)} · ₹${amount}`, "info"),
              ...current.notifications,
            ],
          }));
        } catch (error: any) {
          set((current) => ({
            notifications: [
              notify("Bet rejected", error.message || "Unable to place bet.", "loss"),
              ...current.notifications,
            ],
          }));
        }
      },
      tick: () => {
        set((state) => ({
          secondsLeft: Math.max(0, state.secondsLeft - 1)
        }));
      },
      setSecondsLeft: (secondsLeft) => set({ secondsLeft }),
      applyRoundStarted: () => {},
      applyCountdown: () => {},
      applyResult: () => {},
    }),
    {
      name: "color-pro-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        history: state.history,
        myHistory: state.myHistory,
        activeTab: state.activeTab,
      }),
    }
  )
);
