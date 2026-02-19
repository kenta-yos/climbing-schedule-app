"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

const PAGE_SIZE = 8;

const COLORS = [
  "#FF512F", "#F74B4B", "#E8505B", "#D45867",
  "#BC6274", "#A86B7F", "#94758B", "#807E96",
  "#6B8AA0", "#5794AB", "#439EB5", "#2FA8BF",
];

// YAxis の tick をカスタム描画（2行 or 省略対応）
const MAX_CHARS_PER_LINE = 9; // 1行に収める最大文字数
const MAX_LINES = 2;

function CustomYAxisTick({
  x, y, payload,
}: {
  x: number;
  y: number;
  payload: { value: string };
}) {
  const name: string = payload.value;

  // 文字列を MAX_CHARS_PER_LINE ずつ分割
  const chunks: string[] = [];
  for (let i = 0; i < name.length; i += MAX_CHARS_PER_LINE) {
    chunks.push(name.slice(i, i + MAX_CHARS_PER_LINE));
  }

  // 2行を超える場合は2行目末尾に「…」
  let lines = chunks.slice(0, MAX_LINES);
  if (chunks.length > MAX_LINES) {
    const last = lines[MAX_LINES - 1];
    lines[MAX_LINES - 1] = last.slice(0, MAX_CHARS_PER_LINE - 1) + "…";
  }

  const lineHeight = 14;
  const totalHeight = lines.length * lineHeight;
  const startY = y - totalHeight / 2 + lineHeight / 2;

  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={startY + i * lineHeight}
          textAnchor="end"
          fill="#4B5563"
          fontSize={11}
          dominantBaseline="middle"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export function GymFrequencyChart({ logs: actuals }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ジム別集計（全件）
  const countMap: Record<string, number> = {};
  actuals.forEach((l) => {
    countMap[l.gym_name] = (countMap[l.gym_name] || 0) + 1;
  });

  const allData = Object.entries(countMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));

  const visibleData = allData.slice(0, visibleCount);
  const hasMore = visibleCount < allData.length;
  const remaining = allData.length - visibleCount;

  if (allData.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        期間内の実績がありません
      </div>
    );
  }

  // Y軸の幅: 1行あたり最大 MAX_CHARS_PER_LINE 文字 × 約11px
  const yAxisWidth = MAX_CHARS_PER_LINE * 11 + 8; // 固定幅

  // データが変わったら再描画
  const chartKey = visibleData.map((d) => `${d.name}:${d.count}`).join("|");

  // 各バーの高さ（2行テキスト対応のため少し大きめ）
  const barHeight = 50;

  return (
    <div>
      <ResponsiveContainer key={chartKey} width="100%" height={visibleData.length * barHeight + 20}>
        <BarChart
          layout="vertical"
          data={visibleData}
          margin={{ left: 4, right: 44, top: 4, bottom: 4 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={(props) => <CustomYAxisTick {...props} />}
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
            {visibleData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* もっと見る / 閉じる */}
      {(hasMore || visibleCount > PAGE_SIZE) && (
        <div className="flex gap-2 mt-2 justify-center">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="text-xs text-orange-500 font-medium px-3 py-1.5 rounded-full border border-orange-200 hover:bg-orange-50 transition-colors active:scale-95"
            >
              もっと見る（残り{remaining}件）
            </button>
          )}
          {visibleCount > PAGE_SIZE && (
            <button
              onClick={() => setVisibleCount(PAGE_SIZE)}
              className="text-xs text-gray-400 font-medium px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors active:scale-95"
            >
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
