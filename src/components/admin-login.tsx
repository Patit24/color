"use client";

import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const response = await apiRequest<{ admin?: { passwordChangeRequired?: boolean } }>("/admin-auth/login", {
        method: "POST",
        body: JSON.stringify({ adminId: email, email, password, remember })
      });
      if (response.admin?.passwordChangeRequired) {
        router.push("/admin/change-password");
        return;
      }
      router.push("/admin/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#fff7f4] px-4 text-[#2a1212]">
      <section className="w-full max-w-md overflow-hidden rounded-[34px] bg-white shadow-2xl shadow-red-900/20">
        <div className="bg-gradient-to-r from-[#bb102d] via-[#f2373f] to-[#0ba668] p-6 text-white">
          <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <ShieldCheck />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Secure console</p>
          <h1 className="mt-2 text-4xl font-black">Admin Login</h1>
          <p className="mt-2 text-sm font-semibold text-white/75">
            HTTP-only JWT cookies, refresh rotation, CSRF protection, IP and device logging.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Admin ID or Email</span>
            <div className="mt-2 flex h-14 items-center gap-3 rounded-2xl bg-[#fff0ed] px-4">
              <Mail size={18} className="text-[#bb102d]" />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="text"
                required
                className="w-full bg-transparent text-base font-bold outline-none"
                placeholder="superadmin"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">Password</span>
            <div className="mt-2 flex h-14 items-center gap-3 rounded-2xl bg-[#fff0ed] px-4">
              <Lock size={18} className="text-[#bb102d]" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-transparent text-base font-bold outline-none"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="flex items-center justify-between rounded-2xl bg-[#fff0ed] p-3 text-sm font-black">
            Remember this device
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-5 accent-[#bb102d]"
            />
          </label>

          <button
            disabled={loading}
            className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login to dashboard"}
          </button>

          {status && (
            <p className="rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">
              {status}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
