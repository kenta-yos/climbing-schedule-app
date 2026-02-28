"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { getTodayJST, formatMMDD } from "@/lib/utils";
import { deleteClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { TIME_SLOTS } from "@/lib/constants";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  onDeleted: () => void;
};

const DEFAULT_SHOW = 3;

export function UpcomingPlans({ logs, onDeleted }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = getTodayJST();

  const plans = logs
    .filter((l) => l.type === "予定" && l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleEdit = (logId: string) => {
    router.push(`/home/plan?editId=${logId}`);
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteClimbingLog(id);
      toast({ title: "予定を削除しました", variant: "success" as any });
      onDeleted();
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <CalendarDays size={15} className="text-blue-500" />
          今後の予定
        </h3>
        <p className="text-center text-sm text-gray-400 py-4">予定はありません</p>
      </div>
    );
  }

  const visible = expanded ? plans : plans.slice(0, DEFAULT_SHOW);
  const hasMore = plans.length > DEFAULT_SHOW;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
        <CalendarDays size={15} className="text-blue-500" />
        今後の予定
      </h3>
      <div className="space-y-0">
        {visible.map((log) => {
          const slotInfo = TIME_SLOTS.find((s) => s.value === log.time_slot);
          return (
            <div
              key={log.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              <div className="w-10 text-center flex-shrink-0">
                <div className="text-xs font-semibold text-gray-700">{formatMMDD(log.date)}</div>
                {slotInfo && (
                  <Image
                    src={slotInfo.icon}
                    alt={slotInfo.label}
                    width={14}
                    height={14}
                    className="mx-auto mt-0.5 object-contain"
                  />
                )}
              </div>
              <div className="w-0.5 h-8 rounded-full bg-blue-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{log.gym_name}</div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => handleEdit(log.id)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(log.id)}
                  disabled={deletingId === log.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                >
                  {deletingId === log.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 text-xs text-blue-500 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {expanded ? "閉じる" : `もっと見る（残り${plans.length - DEFAULT_SHOW}件）`}
        </button>
      )}
    </div>
  );
}
