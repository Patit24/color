"use client";

import { useEffect, useState } from "react";
import { SimplePage } from "@/components/simple-page";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Copy, Gift, Share2, Users, CircleDollarSign } from "lucide-react";

type ReferralData = {
  referralCode: string;
  referralCount: number;
  totalEarned: number;
  referralBalance: number;
  referrals: Array<{ id: string; phone: string; joinedAt: string }>;
};

export default function ReferPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = async () => {
    try {
      const getReferralDataFn = httpsCallable(functions, "getReferralData");
      const { data: res } = await getReferralDataFn() as any;
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const copyCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      alert("Referral code copied!");
    }
  };

  const claimEarnings = async () => {
    if (!data || data.referralBalance <= 0) return;
    setClaiming(true);
    try {
      const claimFn = httpsCallable(functions, "claimReferralEarnings");
      await claimFn();
      alert("Earnings claimed to winning wallet!");
      void load();
    } catch (error: any) {
      alert(error.message || "Failed to claim earnings");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <SimplePage title="Refer & Earn" subtitle="Loading your rewards..."><div className="h-40 animate-pulse rounded-3xl bg-white" /></SimplePage>;

  return (
    <SimplePage title="Refer & Earn" subtitle="Invite friends and earn ₹50 on their first deposit.">
      <div className="space-y-6">
        {/* Referral Card */}
        <div className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#bb102d] to-[#f2373f] p-6 text-white shadow-2xl shadow-red-900/20">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Your Referral Code</p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <h2 className="text-4xl font-black tracking-tight">{data?.referralCode}</h2>
              <button onClick={copyCode} className="grid size-12 place-items-center rounded-2xl bg-white/20 backdrop-blur-md">
                <Copy size={20} />
              </button>
            </div>
            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-[22px] bg-white py-4 text-base font-black text-[#bb102d]">
              <Share2 size={18} />
              Share Invite Link
            </button>
          </div>
          <Gift className="absolute -bottom-6 -right-6 size-32 rotate-12 text-white/10" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-red-900/5">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-[#fff0ed] text-[#bb102d]">
              <Users size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#9a3434]">Total Referrals</p>
            <p className="mt-1 text-xl font-black">{data?.referralCount}</p>
          </div>
          <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-red-900/5">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <CircleDollarSign size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#9a3434]">Total Earned</p>
            <p className="mt-1 text-xl font-black">₹{data?.totalEarned}</p>
          </div>
        </div>

        {/* Claim Wallet */}
        <div className="rounded-[34px] bg-white p-6 shadow-2xl shadow-red-900/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9a3434]">Claimable Rewards</p>
              <h3 className="mt-1 text-2xl font-black text-emerald-600">₹{data?.referralBalance}</h3>
            </div>
            <button
              onClick={claimEarnings}
              disabled={claiming || !data?.referralBalance}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {claiming ? "Claiming..." : "Claim Now"}
            </button>
          </div>
          <p className="mt-4 text-[10px] font-bold text-[#9a3434]/60">
            * Referral bonuses are credited to your Winning Wallet for immediate withdrawal.
          </p>
        </div>

        {/* Referral List */}
        <section>
          <h3 className="mb-4 px-2 text-xs font-black uppercase tracking-widest text-[#9a3434]">Recent Invites</h3>
          <div className="space-y-3">
            {data?.referrals.length === 0 ? (
              <div className="rounded-[22px] bg-white p-8 text-center text-sm font-bold text-[#9a3434]/40">
                No referrals yet. Start sharing your code!
              </div>
            ) : (
              data?.referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-md">
                  <div>
                    <p className="text-sm font-black text-[#2a1212]">{ref.phone}</p>
                    <p className="text-[10px] font-bold text-[#9a3434]">
                      Joined on {new Date(ref.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-600">
                    VERIFIED
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </SimplePage>
  );
}
