import Link from "next/link";
import { SimplePage } from "@/components/simple-page";

export default function RegisterPage() {
  return (
    <SimplePage title="Signup Closed" subtitle="Public registration is disabled for this platform.">
      <div className="rounded-[24px] bg-white p-5 text-center shadow-xl shadow-red-900/10">
        <p className="font-black">Accounts are created by admins or verified Telegram connection.</p>
        <Link href="/login" className="mt-4 inline-grid h-12 place-items-center rounded-2xl bg-[#bb102d] px-5 text-sm font-black text-white">
          Go to login
        </Link>
      </div>
    </SimplePage>
  );
}
