import { SimplePage } from "@/components/simple-page";

export default function HistoryPage() {
  return (
    <SimplePage title="History" subtitle="Game and player bet history with auto-scroll ready data.">
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center justify-between rounded-[22px] bg-white p-4 shadow-xl shadow-red-900/10">
            <span className="font-black">20260516{100520 - index}</span>
            <span className={index % 2 ? "font-black text-emerald-600" : "font-black text-red-600"}>
              {index % 2 ? "Won" : "Lost"}
            </span>
          </div>
        ))}
      </div>
    </SimplePage>
  );
}
