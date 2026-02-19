"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

// ジム名の文字数から必要なYAxis幅を計算（1文字あたり約11px、最小80・最大200）
function calcYAxisWidth(names: string[]): number {
  const max = Math.max(...names.map((n) => n.length));
  return Math.min(Math.max(max * 11, 80), 200);
}

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

  const yAxisWidth = calcYAxisWidth(data.map((d) => d.name));

  // グラデーション色（順位によって変化）
  const COLORS = [
    "#FF512F", "#F74B4B", "#E8505B", "#D45867",
    "#BC6274", "#A86B7F", "#94758B", "#807E96",
  ];

  // データが変わったらグラフを再描画させるためkeyにデータのハッシュを使う
  const chartKey = data.map((d) => `${d.name}:${d.count}`).join("|");

  return (
    <ResponsiveContainer key={chartKey} width="100%" height={data.length * 44 + 20}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 0, right: 40, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={yAxisWidth}
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
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          <LabelList
            dataKey="count"
            position="right"
            formatter={(v: number) => `${v}回`}
            style={{ fontSize: 11, fill: "#6B7280" }}
          />
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i] || COLORS[COLORS.length - 1]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
