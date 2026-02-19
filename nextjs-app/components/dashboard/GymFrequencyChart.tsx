"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

export function GymFrequencyChart({ logs: actuals }: Props) {
  // ジム別集計
  const countMap: Record<string, number> = {};
  actuals.forEach((l) => {
    countMap[l.gym_name] = (countMap[l.gym_name] || 0) + 1;
  });

  const data = Object.entries(countMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        期間内の実績がありません
      </div>
    );
  }

  // グラデーション色（順位によって変化）
  const COLORS = [
    "#FF512F", "#F74B4B", "#E8505B", "#D45867",
    "#BC6274", "#A86B7F", "#94758B", "#807E96",
  ];

  return (
    <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 0, right: 32, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12, fill: "#4B5563" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [`${value}回`, "訪問回数"]}
          contentStyle={{
            borderRadius: "12px",
            border: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, fill: "#6B7280" }}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i] || COLORS[COLORS.length - 1]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
