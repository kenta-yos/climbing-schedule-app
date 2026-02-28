"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import { getNowJST } from "@/lib/utils";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

type MonthData = {
  month: string; // "YYYY-MM"
  label: string; // "1月"
  count: number;
};

function buildMonthData(logs: ClimbingLog[]): MonthData[] {
  const now = getNowJST();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const data: MonthData[] = [];

  for (let y = 2026; y <= endYear; y++) {
    const mStart = y === 2026 ? 1 : 1;
    const mEnd = y === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) {
      const monthStr = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${m}月`;
      const count = logs.filter(
        (l) => l.type === "実績" && l.date.startsWith(monthStr)
      ).length;
      data.push({ month: monthStr, label, count });
    }
  }
  return data;
}

function getGymBreakdown(logs: ClimbingLog[], monthStr: string) {
  const monthLogs = logs.filter(
    (l) => l.type === "実績" && l.date.startsWith(monthStr)
  );
  const gymCount: Record<string, number> = {};
  monthLogs.forEach((l) => {
    gymCount[l.gym_name] = (gymCount[l.gym_name] || 0) + 1;
  });
  return Object.entries(gymCount).sort(([, a], [, b]) => b - a);
}

export function MonthlyTrendChart({ logs }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const data = buildMonthData(logs);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const now = getNowJST();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const handleBarClick = (_: unknown, index: number) => {
    const month = data[index]?.month;
    if (!month) return;
    setSelectedMonth((prev) => (prev === month ? null : month));
  };

  const gymEntries = selectedMonth ? getGymBreakdown(logs, selectedMonth) : [];
  const selectedLabel = selectedMonth
    ? `${Number(selectedMonth.split("-")[1])}月`
    : "";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">月別クライミング推移</h3>
        <span className="text-[10px] text-gray-400">タップでジム内訳を表示</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
          />
          <YAxis hide domain={[0, maxCount + 2]} />
          <Bar
            dataKey="count"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            onClick={handleBarClick}
            cursor="pointer"
          >
            <LabelList
              dataKey="count"
              position="top"
              formatter={(v: number) => (v > 0 ? `${v}` : "")}
              style={{ fontSize: 11, fill: "#6B7280", fontWeight: 600 }}
            />
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  selectedMonth === d.month
                    ? "#DD2476"
                    : d.month === currentMonthStr
                    ? "#FF512F"
                    : "#FDBA74"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 選択月のジム内訳 */}
      {selectedMonth && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">{selectedLabel}のジム内訳</p>
          {gymEntries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
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
          ) : (
            <p className="text-xs text-gray-400">実績はありません</p>
          )}
        </div>
      )}
    </div>
  );
}
