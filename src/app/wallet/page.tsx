"use client";

import { useEffect } from "react";
import { SimplePage } from "@/components/simple-page";
import { useGameStore } from "@/store/game-store";
import Link from "next/link";
import { ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

export default function WalletPage() {
  const balance = useGameStore((state) => state.balance);
  const ledger = useGameStore((state) => state.ledger);
  const syncWallet = useGameStore((state) => state.syncWallet);

  useEffect(() => {
    void syncWallet();
  }, [syncWallet]);

  return (
    <SimplePage title="Wallet" subtitle="Manage your funds and view transaction history.">
      <div className="space-y-4">
        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-red-900/10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Total Balance</p>
          <h2 className="mt-1 text-4xl font-black">₹{balance.toLocaleString("en-IN")}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              href="/deposit"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#bb102d] text-sm font-black text-white"
            >
              <ArrowDownLeft size={16} />
              Deposit
            </Link>
            <Link
              href="/withdraw"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2a1212] text-sm font-black text-white"
            >
              <ArrowUpRight size={16} />
              Withdraw
            </Link>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#9a3434]">Recent Transactions</h3>
            <Clock size={16} className="text-[#9a3434]" />
          </div>

          <div className="space-y-2">
            {ledger.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-[#9a3434]">
                No transactions found.
              </div>
            ) : (
              ledger.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-md">
                  <div>
                    <p className="text-sm font-black text-[#2a1212]">{tx.type.replace(/_/g, " ")}</p>
                    <p className="text-[10px] font-bold text-[#9a3434]">
                      {new Date(tx.createdAt).toLocaleDateString()} · {tx.status}
                    </p>
                  </div>
                  <p className={`text-base font-black ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </SimplePage>
  );
}
