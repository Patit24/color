"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CircleDollarSign,
  Download,
  Eye,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { auth, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { signOut } from "firebase/auth";
import { apiRequest } from "@/lib/api-client";

type Metrics = {
  totalUsers: number;
  totalVolume: number;
  activeBets: number;
  platformProfit: number;
  pendingWithdrawals: number;
};

type AdminUser = {
  _id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  isActive: boolean;
  wallet: {
    depositBalance: number;
    winningBalance: number;
    referralBalance: number;
  };
  createdByAdmin?: string;
};

type PaymentRequest = {
  _id: string;
  userId: { phone: string; email: string };
  type: "DEPOSIT" | "WITHDRAWAL";
  method: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  transactionId?: string;
  upiId?: string;
  bankDetails?: string;
};

type LiveBet = {
  _id: string;
  userId: { phone: string };
  period: string;
  amount: number;
  targetType: string;
  targetValue: string;
  status: string;
};

type FraudEvent = {
  _id: string;
  userId: { phone: string };
  type: string;
  riskScore: number;
  reason: string;
  createdAt: string;
};

type ProfitRow = {
  date: string;
  volume: number;
  profit: number;
};

type RetentionRow = {
  cohort: string;
  size: number;
  d1: number;
  d7: number;
};

export function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [fraud, setFraud] = useState<FraudEvent[]>([]);
  const [profitRows, setProfitRows] = useState<ProfitRow[]>([]);
  const [retentionRows, setRetentionRows] = useState<RetentionRow[]>([]);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    userId: "",
    fullName: "",
    mobile: "",
    password: "",
    initialBalance: 0,
  });

  const [selectedUserForWallet, setSelectedUserForWallet] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"deposit" | "winning" | "offline_withdraw">("deposit");
  const [adjustReason, setAdjustReason] = useState("");

  const [status, setStatus] = useState("Initializing...");

  async function handleAdjustWallet() {
    if (!selectedUserForWallet) return;
    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      alert("Please enter a valid non-zero amount");
      return;
    }

    try {
      setStatus("Adjusting wallet balance...");
      
      const finalAmount = adjustType === "offline_withdraw" ? -Math.abs(amount) : amount;
      const finalType = adjustType === "offline_withdraw" ? "winning" : adjustType;
      const finalReason = adjustReason || (adjustType === "offline_withdraw" ? "Offline Withdrawal" : "Admin adjustment via dashboard");

      // 1. Sync to Firebase (Firestore)
      const adjustFn = httpsCallable(functions, "adjustUserWallet");
      await adjustFn({
        targetUid: selectedUserForWallet._id,
        amount: finalAmount,
        type: finalType
      });

      // 2. Sync to MongoDB/Express backend
      await apiRequest(`/admin/users/${selectedUserForWallet._id}/wallet-adjust`, {
        method: "POST",
        body: JSON.stringify({
          amount: finalAmount,
          reason: finalReason
        })
      });

      setSelectedUserForWallet(null);
      setAdjustAmount("");
      setAdjustReason("");
      setStatus("Wallet balance adjusted successfully");
      void load();
    } catch (err: any) {
      alert(err.message || "Adjustment failed");
    }
  }

  async function createUser() {
    try {
      setStatus("Creating player account...");
      // 1. Create in Firebase/Firestore
      const createUserFn = httpsCallable(functions, "createAdminUser");
      const fbRes = await createUserFn({
        userId: newUser.userId,
        fullName: newUser.fullName,
        mobile: newUser.mobile,
        password: newUser.password,
        initialBalance: newUser.initialBalance,
      });
      const fbData = fbRes.data as { success: boolean; uid: string };
      const firebaseUid = fbData?.uid;

      // 2. Sync to MongoDB/Express backend
      try {
        await apiRequest("/admin/users", {
          method: "POST",
          body: JSON.stringify({
            userId: newUser.userId,
            fullName: newUser.fullName,
            mobile: newUser.mobile,
            password: newUser.password,
            initialWalletBalance: newUser.initialBalance,
            firebaseUid,
          }),
        });
      } catch (mongoError: any) {
        console.warn("MongoDB sync failed, but Firebase user created:", mongoError);
      }

      setShowAddUser(false);
      setNewUser({ userId: "", fullName: "", mobile: "", password: "", initialBalance: 0 });
      setStatus("Player created successfully");
      void load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Creation failed");
    }
  }

  async function load() {
    try {
      setStatus("Syncing live node data...");
      const getAdminDataFn = httpsCallable(functions, "getAdminData");
      
      // If Firebase Auth is not ready, we'll try to use a fallback or wait
      if (!auth.currentUser) {
        setStatus("Firebase Auth not ready, attempting bridge...");
        // We'll give it a moment to initialize or try the backend session
      }

      const { data } = await getAdminDataFn() as any;

      setMetrics(data.metrics);
      setUsers(data.users);
      setCurrentAdmin(data.admin);
      setPayments(data.payments);
      setLiveBets(data.liveBets);
      setLedgerRows(data.transactions);
      setStatus("Live admin data loaded");
    } catch (error: any) {
      console.warn("Dashboard Load Error (will retry):", error);
      // If it fails because of unauthenticated, it means the Firebase token is missing
      // We will show the sync button to help the user bridge the gap
      if (error.code === "unauthenticated" || error.code === "permission-denied") {
        setStatus("Access Denied: Syncing Permissions Required");
      } else {
        setStatus(error instanceof Error ? error.message : "Unable to load admin data");
      }
    }
  }

  async function emergencySync() {
    try {
      setStatus("Triggering Emergency Sync...");
      const setupAdminFn = httpsCallable(functions, "setupAdmin");
      await setupAdminFn();
      setStatus("Sync Complete! Reloading...");
      void load();
    } catch (error: any) {
      setStatus(`Sync Failed: ${error.message}`);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        void load();
      } else {
        router.push("/admin/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  async function action(path: string, body: any, successMsg: string) {
    try {
      await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      setStatus(successMsg);
      void load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed");
    }
  }

  async function logout() {
    await signOut(auth);
    router.push("/admin/login");
  }

  if (!metrics) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fff7f4]">
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldCheck size={48} className="animate-pulse text-[#bb102d]" />
          <p className="max-w-md px-6 text-sm font-black uppercase tracking-widest text-[#9a3434]">{status}</p>
          {status.includes("Denied") && (
            <button
              onClick={emergencySync}
              className="mt-4 flex items-center gap-2 rounded-xl bg-[#bb102d] px-6 py-3 text-sm font-black text-white shadow-xl shadow-red-900/20"
            >
              <RefreshCcw size={16} />
              Repair Permissions
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff7f4] text-[#2a1212]">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#ffd7cf] bg-white/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-r from-[#bb102d] to-[#0ba668] text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black">Color Trade</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#bb102d]">
              Production Node · {status}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            className="flex size-10 items-center justify-center rounded-xl bg-[#fff0ed] text-[#bb102d] transition-all hover:rotate-180"
          >
            <RefreshCcw size={18} />
          </button>
          <button
            onClick={logout}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#2a1212] px-4 text-sm font-black text-white shadow-lg shadow-black/10"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <div className="p-6">
        {/* Metric Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Total Users" value={metrics.totalUsers} icon={<Users size={20} />} tone="red" />
          <Stat label="Total Volume" value={`₹${metrics.totalVolume.toLocaleString()}`} icon={<Activity size={20} />} tone="green" />
          <Stat label="Active Bets" value={metrics.activeBets} icon={<ShieldCheck size={20} />} tone="red" />
          <Stat label="Platform Profit" value={`₹${metrics.platformProfit.toLocaleString()}`} icon={<TrendingUp size={20} />} tone="green" />
          <Stat label="Pending Payouts" value={metrics.pendingWithdrawals} icon={<WalletCards size={20} />} tone="red" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* User Management */}
          <section className="lg:col-span-8">
            <Panel
              title="Registered Users"
              icon={<Users size={18} />}
              action={
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-2 rounded-lg bg-[#bb102d] px-3 py-1.5 text-xs font-black text-white"
                >
                  <UserPlus size={14} /> {showAddUser ? "Close Form" : "Add User"}
                </button>
              }
            >
              <AnimatePresence>
                {showAddUser && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-6 overflow-hidden rounded-2xl bg-[#fff0ed] p-5"
                  >
                    <h3 className="mb-4 text-sm font-black uppercase tracking-tight text-[#bb102d]">Quick Registration</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        placeholder="User ID (login)"
                        className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none"
                        value={newUser.userId}
                        onChange={(e) => setNewUser({ ...newUser, userId: e.target.value })}
                      />
                      <input
                        placeholder="Full Name"
                        className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none"
                        value={newUser.fullName}
                        onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      />
                      <input
                        placeholder="Mobile Number"
                        className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none"
                        value={newUser.mobile}
                        onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })}
                      />
                      <input
                        placeholder="Login Password"
                        type="password"
                        className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                      <input
                        placeholder="Initial Wallet ₹"
                        type="number"
                        className="h-11 rounded-xl bg-white px-3 text-sm font-bold outline-none"
                        value={newUser.initialBalance}
                        onChange={(e) => setNewUser({ ...newUser, initialBalance: Number(e.target.value) })}
                      />
                      <button
                        onClick={createUser}
                        className="h-11 rounded-xl bg-[#bb102d] text-sm font-black text-white"
                      >
                        Create Account
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="overflow-hidden rounded-2xl border border-[#ffd7cf]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fff0ed] text-[10px] font-black uppercase tracking-widest text-[#9a3434]">
                    <tr>
                      <th className="px-4 py-3">User/Phone</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ffd7cf] font-bold">
                    {users.map((user) => (
                      <tr key={user._id} className="hover:bg-[#fff0ed]/50">
                        <td className="px-4 py-3">
                          <p className="text-base font-black">{user.phone}</p>
                          <p className="text-[10px] text-[#9a3434]">{user.userId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-emerald-600">₹{((user.wallet?.depositBalance || 0) + (user.wallet?.winningBalance || 0)).toLocaleString()}</p>
                          <p className="text-[10px] text-[#9a3434]">Win: ₹{user.wallet?.winningBalance || 0}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md px-2 py-1 text-[10px] ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {user.isActive ? "ACTIVE" : "SUSPENDED"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="size-8 grid place-items-center rounded-lg bg-[#fff0ed] text-[#bb102d]">
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUserForWallet(user);
                                setAdjustAmount("");
                                setAdjustReason("");
                              }}
                              className="size-8 grid place-items-center rounded-lg bg-[#fff0ed] text-[#bb102d] hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                              title="Adjust Wallet Balance"
                            >
                              <CircleDollarSign size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                const toggleFn = httpsCallable(functions, "toggleUserStatus");
                                await toggleFn({ targetUid: user._id });
                                void load();
                              }}
                              className="size-8 grid place-items-center rounded-lg bg-[#fff0ed] text-[#bb102d]"
                            >
                              <ShieldCheck size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <Panel title="Real-time Bets" icon={<Activity size={18} />}>
                <div className="max-h-[300px] space-y-2 overflow-auto">
                  {liveBets.map((bet) => (
                    <div key={bet._id} className="flex items-center justify-between rounded-xl bg-[#fff0ed] p-3">
                      <div>
                        <p className="text-xs font-black">{bet.userId.phone}</p>
                        <p className="text-[10px] font-bold text-[#9a3434]">{bet.targetType} · {bet.targetValue}</p>
                      </div>
                      <p className="text-sm font-black text-[#bb102d]">₹{bet.amount}</p>
                    </div>
                  ))}
                  {liveBets.length === 0 && <Empty label="No active bets." />}
                </div>
              </Panel>

              <Panel title="Fraud & Risk" icon={<AlertTriangle size={18} />}>
                <div className="max-h-[300px] space-y-2 overflow-auto">
                  {fraud.map((event) => (
                    <div key={event._id} className="rounded-xl border border-red-100 bg-red-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-red-900">{event.userId.phone}</p>
                        <span className="rounded bg-red-900 px-1.5 py-0.5 text-[10px] font-black text-white">
                          SCORE: {event.riskScore}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-bold text-red-700">{event.reason}</p>
                    </div>
                  ))}
                  {fraud.length === 0 && <Empty label="No risk events flagged." />}
                </div>
              </Panel>
            </div>
          </section>

          {/* Right Sidebar - Analytics & Reviews */}
          <section className="space-y-6 lg:col-span-4">
            <Panel title="Market Performance" icon={<TrendingUp size={18} />}>
              <div className="space-y-4">
                {profitRows.slice(0, 5).map((row) => (
                  <div key={row.date} className="group">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-[#9a3434]">{row.date}</span>
                      <span>₹{row.profit.toLocaleString()}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#fff0ed]">
                      <div
                        className="h-full bg-gradient-to-r from-[#bb102d] to-[#0ba668] transition-all"
                        style={{ width: `${Math.min(100, (row.profit / 50000) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Manual Reviews" icon={<WalletCards size={18} />}>
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {payments.length === 0 ? (
                  <Empty label="No pending requests." />
                ) : (
                  payments.map((request) => (
                    <div key={request._id} className="rounded-2xl bg-[#fff0ed] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {request.type} · ₹{request.amount.toLocaleString()}
                          </p>
                          <p className="text-[10px] font-bold text-[#9a3434]">
                            {request.method} · {request.status} · {request.userId?.phone || "User"}
                          </p>
                          {request.type === "DEPOSIT" && request.transactionId && (
                            <p className="mt-1 text-[10px] font-bold text-blue-800">
                              TXN ID: {request.transactionId}
                            </p>
                          )}
                          {request.type === "WITHDRAWAL" && request.upiId && (
                            <p className="mt-1 text-[10px] font-bold text-blue-800">
                              UPI: {request.upiId}
                            </p>
                          )}
                          {request.type === "WITHDRAWAL" && request.bankDetails && (
                            <p className="mt-1 text-[10px] font-bold text-blue-800">
                              BANK: {request.bankDetails}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              const reviewFn = httpsCallable(functions, "reviewPayment");
                              await reviewFn({ requestId: request._id, action: "APPROVE" });
                              void load();
                            }}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white"
                          >
                            OK
                          </button>
                          <button
                            onClick={async () => {
                              const reviewFn = httpsCallable(functions, "reviewPayment");
                              await reviewFn({ requestId: request._id, action: "REJECT" });
                              void load();
                            }}
                            className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Financial Ledger" icon={<CircleDollarSign size={18} />}>
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {ledgerRows.length === 0 ? (
                  <Empty label="No recent transactions." />
                ) : (
                  ledgerRows.map((tx) => (
                    <div key={tx._id} className="rounded-2xl bg-[#fff0ed] p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-black uppercase tracking-tight">{tx.type.replace(/_/g, " ")}</p>
                        <p className={`font-black ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.amount >= 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <p className="mt-1 font-bold text-[#9a3434]">
                        {tx.userId?.phone || tx.userId?.userId || "Unknown"} · {tx.status} · {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </section>
        </div>

        {/* Admin Personal Activity */}
        <div className="mt-8">
          <Panel title="My Personal Activity" icon={<ShieldCheck size={18} />}>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-sm font-black uppercase tracking-tight text-[#bb102d]">Onboarded Players</h3>
                <div className="space-y-2">
                  {users
                    .filter((u) => u.createdByAdmin === currentAdmin?.email || u.createdByAdmin === currentAdmin?._id)
                    .map((u) => (
                      <div key={u._id} className="flex items-center justify-between rounded-2xl bg-[#fff0ed] p-3">
                        <div>
                          <p className="text-sm font-black">{u.fullName}</p>
                          <p className="text-[10px] font-bold text-[#9a3434]">{u.phone}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-600">ACTIVE</span>
                      </div>
                    ))}
                  {users.filter((u) => u.createdByAdmin === currentAdmin?.email || u.createdByAdmin === currentAdmin?._id).length === 0 && (
                    <Empty label="You haven't onboarded any players yet." />
                  )}
                </div>
              </div>
              <div className="rounded-[28px] bg-[#fff0ed]/50 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#bb102d]">Admin Profile</p>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-[#9a3434]">Name:</span>
                    <span>{currentAdmin?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-[#9a3434]">Email:</span>
                    <span>{currentAdmin?.email}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-[#9a3434]">Role:</span>
                    <span className="uppercase">{currentAdmin?.role}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-[#9a3434]">Last Login:</span>
                    <span>{new Date(currentAdmin?.lastLogin).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {selectedUserForWallet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md overflow-hidden rounded-[34px] bg-white p-6 shadow-2xl border border-[#ffd7cf]"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff0ed] text-[#bb102d]">
                  <CircleDollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-[#bb102d]">Adjust User Wallet</h3>
                  <p className="text-[10px] text-[#9a3434] font-bold">UID: {selectedUserForWallet.userId} ({selectedUserForWallet.phone})</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-[#9a3434] block mb-1.5">Adjustment Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setAdjustType("deposit")}
                      className={`h-10 rounded-xl font-bold text-[10px] border transition-all ${adjustType === "deposit" ? "bg-[#bb102d] text-white border-transparent" : "bg-white border-[#ffd7cf] text-[#9a3434]"}`}
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => setAdjustType("winning")}
                      className={`h-10 rounded-xl font-bold text-[10px] border transition-all ${adjustType === "winning" ? "bg-[#bb102d] text-white border-transparent" : "bg-white border-[#ffd7cf] text-[#9a3434]"}`}
                    >
                      Winning
                    </button>
                    <button
                      onClick={() => setAdjustType("offline_withdraw")}
                      className={`h-10 rounded-xl font-bold text-[10px] border transition-all ${adjustType === "offline_withdraw" ? "bg-[#bb102d] text-white border-transparent" : "bg-white border-[#ffd7cf] text-[#9a3434]"}`}
                    >
                      Offline Withdraw
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-[#9a3434] block mb-1.5">
                    {adjustType === "offline_withdraw" ? "Withdrawal Amount (₹)" : "Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    placeholder={adjustType === "offline_withdraw" ? "e.g. 500" : "e.g. 500 or -500 to subtract"}
                    className="w-full h-11 rounded-xl bg-[#fff0ed] px-3 text-sm font-bold outline-none text-[#bb102d]"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                  <p className="text-[9px] text-[#9a3434]/60 font-bold mt-1">
                    {adjustType === "offline_withdraw"
                      ? "Entering a value here will automatically deduct the balance from their Winning Wallet."
                      : "Use negative values to deduct balance."}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-[#9a3434] block mb-1.5">Reason / Description</label>
                  <input
                    type="text"
                    placeholder={adjustType === "offline_withdraw" ? "e.g. Processed manually offline" : "e.g. VIP Bonus, Manual correction"}
                    className="w-full h-11 rounded-xl bg-[#fff0ed] px-3 text-sm font-bold outline-none text-[#bb102d]"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                  />
                </div>

                <div className="pt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedUserForWallet(null)}
                    className="h-11 rounded-xl font-bold text-xs border border-[#ffd7cf] text-[#bb102d] hover:bg-[#fff0ed] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustWallet}
                    className="h-11 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    Submit Adjustment
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: "red" | "green" }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-red-900/5">
      <div className={`mb-3 grid size-10 place-items-center rounded-xl ${tone === "red" ? "bg-[#fff0ed] text-[#bb102d]" : "bg-emerald-50 text-emerald-600"}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#9a3434]">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[34px] bg-white p-6 shadow-2xl shadow-red-900/10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-[#fff0ed] text-[#bb102d]">{icon}</div>
          <h2 className="text-base font-black uppercase tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-xs font-bold text-[#9a3434]/60">{label}</p>;
}
