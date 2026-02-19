"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { deleteClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { formatMMDD } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  currentUser: string;
  startDate: string;
  endDate: string;
  onDeleted: () => void;
};

export function LogHistory({ logs, currentUser, startDate, endDate, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 自分のログのみ
  const myLogs = logs.filter((l) => l.user === currentUser);

  // 予定：全ての予定（日付順）
  const plans = myLogs
    .filter((l) => l.type === "予定")
    .sort((a, b) => a.date.localeCompare(b.date));

  // 実績：期間内
  const actuals = myLogs
    .filter((l) => l.type === "実績" && l.date >= startDate && l.date <= endDate)
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

  const LogItem = ({ log }: { log: ClimbingLog }) => {
    const slotInfo = TIME_SLOTS.find((s) => s.value === log.time_slot);
    return (
      <div className="flex items-center gap-3 py-3 px-1 border-b border-gray-50 last:border-0">
        <div className="w-12 text-center flex-shrink-0">
          <div className="text-xs font-semibold text-gray-700">{formatMMDD(log.date)}</div>
          {slotInfo && (
            <Image src={slotInfo.icon} alt={slotInfo.label} width={16} height={16} className="mx-auto mt-0.5 object-contain" />
          )}
        </div>
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: log.type === "実績" ? "#FF512F" : "#3B82F6" }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{log.gym_name}</div>
          <div className={`text-xs mt-0.5 ${log.type === "実績" ? "text-orange-500" : "text-blue-500"}`}>
            {log.type}
          </div>
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
  };

  return (
    <Tabs defaultValue="plans">
      <TabsList>
        <TabsTrigger value="plans">📅 予定 ({plans.length})</TabsTrigger>
        <TabsTrigger value="actuals">🧗 実績 ({actuals.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="plans">
        {plans.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">予定がありません</div>
        ) : (
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
            {plans.map((log) => <LogItem key={log.id} log={log} />)}
          </div>
        )}
      </TabsContent>
      <TabsContent value="actuals">
        {actuals.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">期間内の実績がありません</div>
        ) : (
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
            {actuals.map((log) => <LogItem key={log.id} log={log} />)}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
