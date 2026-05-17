"use client";

import { useState } from "react";
import { SimplePage } from "@/components/simple-page";
import { useRouter } from "next/navigation";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function DepositPage() {
  const [amount, setAmount] = useState("1000");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) < 30) {
      alert("Minimum deposit is ₹30");
      return;
    }
    if (!transactionId) {
      alert("Please enter the transaction ID.");
      return;
    }

    setLoading(true);
    try {
      const requestDepositFn = httpsCallable(functions, "requestManualDeposit");
      await requestDepositFn({ amount: Number(amount), transactionId });
      alert("Deposit request submitted! Please wait for admin approval.");
      router.push("/");
    } catch (error: any) {
      alert(error.message || "Failed to submit deposit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimplePage title="Deposit" subtitle="Transfer funds to the UPI ID below and submit your transaction ID.">
      <div className="space-y-4">
        <div className="rounded-[22px] bg-white p-6 shadow-xl shadow-red-900/10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Our UPI ID</p>
          <p className="mt-2 text-xl font-bold text-[#bb102d]">admin@colortrade</p>
          <p className="mt-1 text-[10px] text-gray-500">Please transfer exactly the amount you request below.</p>
        </div>

        <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Enter Amount (₹)</span>
          <input
            type="number"
            className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-2xl font-black outline-none focus:ring-4 focus:ring-red-200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {["30", "100", "500"].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`rounded-2xl py-3 text-sm font-black transition ${
                amount === val ? "bg-[#2a1212] text-white" : "bg-white text-[#2a1212] shadow-md"
              }`}
            >
              ₹{val}
            </button>
          ))}
        </div>

        <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Transaction ID / UTR</span>
          <input
            type="text"
            className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-lg font-bold outline-none focus:ring-4 focus:ring-red-200"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="e.g. 123456789012"
          />
        </label>

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Submit Request"}
        </button>
      </div>
    </SimplePage>
  );
}
