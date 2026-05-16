"use client";

import { useState } from "react";
import { UserLogin } from "@/components/user-login";
import { AdminLogin } from "@/components/admin-login";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, User } from "lucide-react";

export default function UnifiedLoginPage() {
  const [mode, setMode] = useState<"user" | "admin">("user");

  return (mode === "user" ? (
    <div className="relative min-h-screen">
      <UserLogin />
      <button
        onClick={() => setMode("admin")}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-[#2a1212]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#2a1212] backdrop-blur-md transition hover:bg-[#2a1212]/20"
      >
        <ShieldCheck size={14} />
        Admin Console
      </button>
    </div>
  ) : (
    <div className="relative min-h-screen">
      <AdminLogin />
      <button
        onClick={() => setMode("user")}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur-md transition hover:bg-white/20"
      >
        <User size={14} />
        Player Login
      </button>
    </div>
  ));
}
