"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { GymFrequencyChart } from "@/components/dashboard/GymFrequencyChart";
import { LogHistory } from "@/components/dashboard/LogHistory";
import { Input } from "@/components/ui/input";
import { getCurrentMonthRange } from "@/lib/utils";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  initialLogs: ClimbingLog[];
  currentUser: string;
};

export function DashboardClient({ initialLogs, currentUser }: Props) {
  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const myLogs = logs.filter((l) => l.user === currentUser);
  const periodActuals = myLogs.filter(
    (l) => l.type === "実績" && l.date >= startDate && l.date <= endDate
  );
  const uniqueGyms = new Set(periodActuals.map((l) => l.gym_name));

  const periodLabel = `${startDate} 〜 ${endDate}`;

  const handleDeleted = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <>
      <PageHeader title="ログ" />
      <div className="px-4 py-4 space-y-4 page-enter">
        {/* 期間選択 */}
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm"
          />
          <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* 統計カード */}
        <StatsCard
          sessions={periodActuals.length}
          gyms={uniqueGyms.size}
          period={periodLabel}
        />

        {/* グラフ */}
        {periodActuals.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">ジム別訪問回数</h3>
            <GymFrequencyChart logs={periodActuals} />
          </div>
        )}

        {/* 履歴 */}
        <LogHistory
          logs={logs}
          currentUser={currentUser}
          startDate={startDate}
          endDate={endDate}
          onDeleted={handleDeleted}
        />
      </div>
    </>
  );
}
