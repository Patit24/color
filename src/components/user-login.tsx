"use client";

import { MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export function UserLogin() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Helper to dynamically look up the user's correct email/userId from Firestore
  async function resolveFirebaseEmail(ident: string): Promise<string> {
    const cleanId = ident.trim();
    if (cleanId.includes("@")) return cleanId;

    try {
      const usersRef = collection(db, "users");
      
      // 1. Try querying by phone number (support raw 10-digit and +91 formats)
      const phoneQueries = [cleanId];
      if (/^\d{10}$/.test(cleanId)) {
        phoneQueries.push(`+91${cleanId}`);
      }

      for (const p of phoneQueries) {
        const qPhone = query(usersRef, where("phone", "==", p), limit(1));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
          const data = snapPhone.docs[0].data();
          if (data.userId) {
            console.log(`Resolved mobile number ${cleanId} to user:`, data.userId);
            return `${data.userId}@colortrade.app`;
          }
        }
      }

      // 2. Try querying by userId
      const qUser = query(usersRef, where("userId", "==", cleanId), limit(1));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        const data = snapUser.docs[0].data();
        if (data.userId) {
          console.log(`Resolved userId identifier to user:`, data.userId);
          return `${data.userId}@colortrade.app`;
        }
      }
    } catch (e) {
      console.warn("Firestore user lookup skipped or failed:", e);
    }

    // Default fallback format
    console.log(`Using default fallback email resolution for identifier:`, cleanId);
    return `${cleanId}@colortrade.app`;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      // 1. Authenticate with Local Backend API
      const { apiRequest } = await import("@/lib/api-client");
      const response = await apiRequest<{ success: boolean; user: any; message?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier, password })
      });

      if (!response.success) {
        throw new Error(response.message || "Unauthorized Access");
      }

      // 2. Bridge to Firebase
      try {
        const userEmail = await resolveFirebaseEmail(identifier);
        await signInWithEmailAndPassword(auth, userEmail, password);
      } catch (firebaseError: any) {
        if (firebaseError.code === "auth/user-not-found" || firebaseError.code === "auth/invalid-credential") {
          try {
            console.log("Auto-creating Firebase account to sync with backend...");
            const userEmail = await resolveFirebaseEmail(identifier);
            await createUserWithEmailAndPassword(auth, userEmail, password);
          } catch (createError) {
            console.warn("Firebase auto-create failed:", createError);
          }
        } else {
          console.warn("Firebase bridge failed, but backend login succeeded:", firebaseError);
        }
      }

      router.push("/");
    } catch (error: any) {
      const backendErrorMsg = error instanceof Error ? error.message : "Unauthorized Access";
      // 3. Fallback: If local Express login failed (e.g. 401), try to verify against Firebase Auth
      // and dynamically sync user metadata to MongoDB.
      try {
        setStatus("Verifying credentials via secure channel...");
        const userEmail = await resolveFirebaseEmail(identifier);
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
        const idToken = await userCredential.user.getIdToken();
        
        setStatus("Syncing account database...");
        const { apiRequest } = await import("@/lib/api-client");
        await apiRequest<{ success: boolean }>("/auth/firebase-sync", {
          method: "POST",
          body: JSON.stringify({ idToken, password, identifier })
        });
        
        router.push("/");
        return;
      } catch (syncError: any) {
        // Silently catch Firebase sync error and show the original backend error
        // This prevents scary console errors when the user simply types the wrong password.
        setStatus(backendErrorMsg);
        setPassword("");
        setSubmitting(false);
        return;
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#fff7f4] px-4 py-8">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-r from-[#bb102d] to-[#0ba668] text-white shadow-2xl">
            <UserRound size={32} />
          </div>
          <h1 className="text-3xl font-black text-[#2a1212]">Player Login</h1>
          <p className="mt-1 text-sm font-bold text-[#9a3434]">Enter your credentials to continue</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
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
            className="h-14 w-full rounded-[22px] bg-[#bb102d] text-base font-black text-white shadow-xl shadow-red-600/25 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Login securely"}
          </button>
          
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
      </div>
    </div>
  );
}
