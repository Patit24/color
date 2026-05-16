"use client";

import { useState } from "react";
import { SimplePage } from "@/components/simple-page";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/game-store";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [method, setMethod] = useState("UPI");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const balance = useGameStore((state) => state.balance);
  const syncWallet = useGameStore((state) => state.syncWallet);

  const handleWithdraw = async () => {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount < 500) {
      alert("Minimum withdrawal is ₹500");
      return;
    }

    if (!payoutAddress) {
      alert("Please provide a payout address (UPI ID or Bank Details)");
      return;
    }

    setLoading(true);
    try {
      const withdrawFn = httpsCallable(functions, "requestWithdrawal");
      await withdrawFn({
        amount: numAmount,
        upiId: method === "UPI" ? payoutAddress : "",
        bankDetails: method === "BANK" ? payoutAddress : "",
      });
      alert("Withdrawal request submitted! It will be reviewed by admin.");
      await syncWallet();
      router.push("/wallet");
    } catch (error: any) {
      alert(error.message || "Failed to submit withdrawal request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimplePage title="Withdraw" subtitle="Withdraw your winning balance to your account.">
      <div className="space-y-4">
        <div className="rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Available Balance</p>
          <p className="text-2xl font-black">₹{balance.toLocaleString("en-IN")}</p>
        </div>

        <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Withdraw Amount (₹)</span>
          <input
            type="number"
            className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-xl font-black outline-none focus:ring-4 focus:ring-red-200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Min 500"
          />
        </label>

        <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Withdraw Method</span>
          <select
            className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-base font-bold outline-none"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="UPI">UPI (Fastest)</option>
            <option value="BANK">Bank Transfer</option>
            <option value="CRYPTO">Crypto (USDT)</option>
          </select>
        </label>

        <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">
            {method === "UPI" ? "UPI ID" : method === "BANK" ? "Account No + IFSC" : "Wallet Address"}
          </span>
          <input
            type="text"
            className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-base font-bold outline-none focus:ring-4 focus:ring-red-200"
            value={payoutAddress}
            onChange={(e) => setPayoutAddress(e.target.value)}
            placeholder={method === "UPI" ? "player@upi" : "Name, Account, IFSC"}
          />
        </label>

        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Withdrawal Request"}
        </button>
      </div>
    </SimplePage>
  );
}
