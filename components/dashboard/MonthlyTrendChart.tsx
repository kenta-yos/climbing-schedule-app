"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from "recharts";
import { getNowJST } from "@/lib/utils";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

export function MonthlyTrendChart({ logs }: Props) {
  const now = getNowJST();
  const data: { month: string; label: string; count: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
    const count = logs.filter(
      (l) => l.type === "実績" && l.date.startsWith(monthStr)
    ).length;
    data.push({ month: monthStr, label, count });
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">月別クライミング推移</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
          />
          <YAxis hide domain={[0, maxCount + 2]} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
            <LabelList
              dataKey="count"
              position="top"
              formatter={(v: number) => (v > 0 ? `${v}` : "")}
              style={{ fontSize: 11, fill: "#6B7280", fontWeight: 600 }}
            />
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? "#FF512F" : "#FDBA74"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
