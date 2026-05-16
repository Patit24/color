"use client";

import { Gift, LifeBuoy, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, PrimaryAction, SimplePage } from "@/components/simple-page";
import { apiRequest } from "@/lib/api-client";

type ProfileUser = {
  userId: string;
  fullName?: string;
  mobile?: string;
  telegramUsername?: string;
  referralCode?: string;
  role?: string;
  accountType?: string;
  status?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ user: ProfileUser }>("/auth/me")
      .then((payload) => {
        if (active) setUser(payload.user);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load profile");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      window.localStorage.removeItem("accessToken");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
      setLoggingOut(false);
    }
  }

  return (
    <SimplePage title="Profile" subtitle="KYC, limits, notifications, and referral settings.">
      <div className="space-y-3">
        {error ? (
          <div className="rounded-[22px] border border-red-200 bg-white p-4 text-sm font-bold text-[#bb102d] shadow-xl shadow-red-900/10">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-[22px] bg-white shadow-xl shadow-red-900/10" />
            <div className="h-20 animate-pulse rounded-[22px] bg-white shadow-xl shadow-red-900/10" />
            <div className="h-20 animate-pulse rounded-[22px] bg-white shadow-xl shadow-red-900/10" />
          </div>
        ) : (
          <>
            <Field label="Player name" value={user?.fullName || "Player"} />
            <Field label="User ID" value={user?.userId || "Not available"} />
            <Field label="Mobile" value={user?.mobile || "Not linked"} />
            <Field label="Telegram" value={user?.telegramUsername ? `@${user.telegramUsername}` : "Not connected"} />
            <Field label="Referral code" value={user?.referralCode || "Not generated"} />
            <Field label="Account type" value={user?.accountType || user?.role || "User"} />
            <Field label="KYC status" value={user?.status === "ACTIVE" ? "Pending verification" : user?.status || "Pending verification"} />
          </>
        )}

        <PrimaryAction label="Save profile" />

        <Link
          href="/refer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-yellow-400 to-orange-500 text-base font-black text-white shadow-xl shadow-orange-500/20"
        >
          <Gift size={18} />
          Refer & Earn
        </Link>

        <a
          href="https://t.me/color_pro_support"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[#0088cc] text-base font-black text-white shadow-xl shadow-blue-500/20"
        >
          <LifeBuoy size={18} />
          Customer Support
        </a>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border border-[#bb102d]/15 bg-white text-base font-black text-[#bb102d] shadow-xl shadow-red-900/10 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut size={18} />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </SimplePage>
  );
}
