"use client";

import { getNowJST } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  selectedMonth: string; // "YYYY-MM"
  onMonthChange: (month: string) => void;
};

function buildMonthOptions(): { value: string; label: string }[] {
  const now = getNowJST();
  const options: { value: string; label: string }[] = [];
  // 2026年1月〜今月（新しい順）
  const startYear = 2026;
  const startMonth = 1;
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  for (let y = endYear; y >= startYear; y--) {
    const mStart = y === startYear ? startMonth : 1;
    const mEnd = y === endYear ? endMonth : 12;
    for (let m = mEnd; m >= mStart; m--) {
      const value = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${y}年${m}月`;
      options.push({ value, label });
    }
  }
  return options;
}

export function MonthlyStats({ logs, selectedMonth, onMonthChange }: Props) {
  const monthOptions = buildMonthOptions();

  const monthActuals = logs.filter(
    (l) => l.type === "実績" && l.date.startsWith(selectedMonth)
  );

  // ジム別集計
  const gymCount: Record<string, number> = {};
  monthActuals.forEach((l) => {
    gymCount[l.gym_name] = (gymCount[l.gym_name] || 0) + 1;
  });
  const gymEntries = Object.entries(gymCount).sort(([, a], [, b]) => b - a);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      {/* 年月セレクター */}
      <Select value={selectedMonth} onValueChange={onMonthChange}>
        <SelectTrigger className="w-full mb-4">
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

      {/* 月間サマリー */}
      <div className="text-center mb-3">
        <div className="text-4xl font-bold text-gray-900">
          {monthActuals.length}
          <span className="text-base font-medium text-gray-500 ml-1">回</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">登った回数</p>
      </div>

      {/* ジム内訳バブル */}
      {gymEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {gymEntries.map(([gym, cnt]) => (
            <span
              key={gym}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            >
              <span>{gym}</span>
              <span className="bg-white rounded-full px-1.5 py-0.5 text-[10px] font-bold text-orange-500 leading-none">
                ×{cnt}
              </span>
            </span>
          ))}
        </div>
      )}

      {monthActuals.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-2">この月の実績はありません</p>
      )}
    </div>
  );
}
