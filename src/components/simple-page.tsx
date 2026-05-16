import { ArrowLeft, CircleDollarSign, ShieldCheck } from "lucide-react";
import Link from "next/link";

type SimplePageProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function SimplePage({ title, subtitle, children }: SimplePageProps) {
  return (
    <main className="min-h-screen bg-[#fff7f4] text-[#2a1212]">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fff7f4] px-4 py-4 shadow-2xl shadow-black/20">
        <header className="mb-4 rounded-[28px] bg-gradient-to-r from-[#bb102d] to-[#0ba668] p-4 text-white shadow-xl shadow-red-900/20">
          <Link href="/" className="mb-5 inline-grid size-10 place-items-center rounded-full bg-white/15">
            <ArrowLeft size={18} />
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Color Pro</p>
          <h1 className="mt-1 text-3xl font-black">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-white/75">{subtitle}</p>
        </header>
        {children}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white p-4 shadow-xl shadow-red-900/10">
            <CircleDollarSign className="mb-3 text-[#bb102d]" />
            <p className="text-sm font-black">Demo wallet</p>
            <p className="text-xs font-bold text-[#9a3434]">No real payments are processed.</p>
          </div>
          <div className="rounded-[24px] bg-white p-4 shadow-xl shadow-red-900/10">
            <ShieldCheck className="mb-3 text-emerald-600" />
            <p className="text-sm font-black">KYC ready</p>
            <p className="text-xs font-bold text-[#9a3434]">Provider hooks can be added.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-[#9a3434]">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-2xl bg-[#fff0ed] px-4 text-base font-black outline-none focus:ring-4 focus:ring-red-200"
        defaultValue={value}
      />
    </label>
  );
}

export function PrimaryAction({ label }: { label: string }) {
  return (
    <button className="h-14 w-full rounded-[22px] bg-gradient-to-r from-[#ff3333] to-[#0ba668] text-base font-black text-white shadow-xl shadow-red-600/25">
      {label}
    </button>
  );
}
