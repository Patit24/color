"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function AdminChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      await apiRequest("/admin-auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      router.push("/admin/login");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#fff7f4] px-4 text-[#2a1212]">
      <form onSubmit={submit} className="w-full max-w-md rounded-[34px] bg-white p-5 shadow-2xl shadow-red-900/20">
        <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-[#fff0ed] text-[#bb102d]">
          <LockKeyhole />
        </div>
        <h1 className="text-3xl font-black">Change Password</h1>
        <p className="mt-2 text-sm font-bold text-[#9a3434]">
          Default admin credentials must be changed before continuing.
        </p>
        <input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          placeholder="Current password"
          className="mt-5 h-14 w-full rounded-2xl bg-[#fff0ed] px-4 font-bold outline-none"
        />
        <input
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          type="password"
          placeholder="New password"
          className="mt-3 h-14 w-full rounded-2xl bg-[#fff0ed] px-4 font-bold outline-none"
        />
        <button
          disabled={loading}
          className="mt-4 h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] font-black text-white disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
        {status && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{status}</p>}
      </form>
    </main>
  );
}
