import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 size={28} className="animate-spin text-orange-400" />
      <p className="text-sm text-gray-400">読み込み中…</p>
    </div>
  );
}
