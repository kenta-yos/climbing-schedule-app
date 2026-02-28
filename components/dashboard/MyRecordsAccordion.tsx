"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Trash2, Database } from "lucide-react";
import { deleteClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { formatMMDD } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  currentUser: string;
  onDeleted: () => void;
};

export function MyRecordsAccordion({ logs, currentUser, onDeleted }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const actuals = logs
    .filter((l) => l.type === "実績" && l.user === currentUser)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteClimbingLog(id);
      toast({ title: "削除しました", variant: "success" as any });
      onDeleted();
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Database size={15} className="text-gray-400" />
          マイデータ管理
          <span className="text-xs text-gray-400 font-normal ml-1">({actuals.length}件)</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-4">
          {actuals.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">実績データはありません</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {actuals.map((log) => {
                const slotInfo = TIME_SLOTS.find((s) => s.value === log.time_slot);
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0"
                  >
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-700">{formatMMDD(log.date)}</div>
                      {slotInfo && (
                        <Image
                          src={slotInfo.icon}
                          alt={slotInfo.label}
                          width={16}
                          height={16}
                          className="mx-auto mt-0.5 object-contain"
                        />
                      )}
                    </div>
                    <div className="w-1 h-10 rounded-full bg-orange-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{log.gym_name}</div>
                      <div className="text-xs text-orange-500 mt-0.5">実績</div>
                    </div>
                    <button
                      onClick={() => handleDelete(log.id)}
                      disabled={deletingId === log.id}
                      className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      {deletingId === log.id ? (
                        <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
