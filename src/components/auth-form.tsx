"use client";

import { MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export function AuthForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");

    try {
      if (identifier.trim().toLowerCase() === "superadmin") {
        setStatus("Admin accounts sign in from the Admin Login page below.");
        setSubmitting(false);
        return;
      }
      // Try email pattern if identifier is just a mobile or userId
      const email = identifier.includes("@") ? identifier : `${identifier}@colortrade.app`;
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">User ID or Mobile</span>
        <div className="mt-2 flex h-12 items-center gap-3 rounded-2xl bg-[#fff0ed] px-4">
          <UserRound size={18} className="text-[#bb102d]" />
          <input
            value={identifier}
            placeholder="demouser"
            onChange={(event) => setIdentifier(event.target.value)}
            className="w-full bg-transparent text-base font-black outline-none"
          />
        </div>
      </label>
      <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Password</span>
        <input
          value={password}
          type="password"
          placeholder="Demo@123"
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-base font-black outline-none focus:ring-4 focus:ring-red-200"
        />
      </label>
      <label className="flex items-center justify-between rounded-2xl bg-[#fff0ed] p-3 text-sm font-black">
        Remember login
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="size-5 accent-[#bb102d]"
        />
      </label>
      <button
        disabled={submitting}
        className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Login securely"}
      </button>
      <Link
        href="/admin/login"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border border-[#bb102d]/15 bg-white text-base font-black text-[#bb102d] shadow-xl shadow-red-900/10"
      >
        <ShieldCheck size={18} />
        Admin Login
      </Link>
      <button
        type="button"
        onClick={() => setStatus("Open the Telegram bot and send /start to connect your account.")}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[#2b1215] text-base font-black text-white"
      >
        <MessageCircle size={18} />
        Connect Telegram
      </button>
      {status && (
        <p className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">
          {status}
        </p>
      )}
      <p className="text-center text-xs font-bold text-[#9a3434]">
        No public signup. Accounts are created by admin or Telegram verification.
      </p>
    </form>
  );
}
