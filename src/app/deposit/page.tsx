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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) < 100) {
      alert("Minimum deposit is ₹100");
      return;
    }

    setLoading(true);
    try {
      const initiateFn = httpsCallable(functions, "initiateDeposit");
      const { data } = await initiateFn({ amount: Number(amount) }) as any;
      const { order } = data;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: order.amount,
        currency: order.currency,
        name: "Color Trade",
        description: `Deposit for User Wallet`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            const verifyFn = httpsCallable(functions, "verifyDeposit");
            await verifyFn({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              amount: Number(amount)
            });
            alert("Deposit successful!");
            router.push("/");
          } catch (err: any) {
            alert(err.message || "Verification failed. Contact support.");
          }
        },
        prefill: {
          name: "User",
          email: "user@example.com",
        },
        theme: {
          color: "#bb102d",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      alert(error.message || "Failed to initiate deposit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimplePage title="Deposit" subtitle="Securely add funds to your wallet using Razorpay.">
      <div className="space-y-4">
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
          {["500", "1000", "5000"].map((val) => (
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

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Deposit Now"}
        </button>
      </div>
    </SimplePage>
  );
}
