"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getNowJST, getTodayJST, formatMMDD, getMonthOptions } from "@/lib/utils";
import type { SetSchedule } from "@/lib/supabase/queries";

type Props = {
  schedules: SetSchedule[];
};

export function ScheduleClient({ schedules }: Props) {
  const now = getNowJST();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const monthOptions = getMonthOptions();
  const today = getTodayJST();

  // 選択した月のスケジュール
  const filtered = schedules
    .filter((s) => s.start_date.startsWith(selectedMonth))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const formatRange = (start: string, end: string) => {
    const s = formatMMDD(start);
    const e = formatMMDD(end);
    return s === e ? s : `${s}〜${e}`;
  };

  return (
    <>
      <PageHeader title="セットスケジュール" />
      <div className="px-4 py-4 space-y-3 page-enter">
        {/* 月選択 */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* スケジュール一覧 */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm">この月のスケジュールはありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {filtered.map((schedule, i) => {
              const isPast = schedule.end_date < today;
              return (
                <div
                  key={schedule.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i < filtered.length - 1 ? "border-b border-gray-50" : ""
                  } ${isPast ? "opacity-50" : ""}`}
                >
                  {/* 日付アクセント */}
                  <div
                    className={`w-1 h-10 rounded-full flex-shrink-0 ${
                      isPast ? "bg-gray-200" : "climbing-gradient"
                    }`}
                  />

                  {/* 日付 */}
                  <div className="w-20 flex-shrink-0">
                    <span className="text-xs font-mono font-semibold text-gray-700">
                      {formatRange(schedule.start_date, schedule.end_date)}
                    </span>
                  </div>

                  {/* ジム名 */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isPast ? "text-gray-400" : "text-gray-800"}`}>
                      {schedule.gym_name}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
