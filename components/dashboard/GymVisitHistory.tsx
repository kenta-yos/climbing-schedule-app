"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { getTodayJST, daysDiff } from "@/lib/utils";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

type GymSummary = {
  gymName: string;
  totalCount: number;
  lastVisit: string; // YYYY-MM-DD
  daysSinceLastVisit: number;
};

const DEFAULT_SHOW = 6;

function formatDateYMD(dateStr: string): string {
  const datePart = dateStr.slice(0, 10); // "YYYY-MM-DD" 部分のみ取得
  const [y, m, d] = datePart.split("-");
  return `${y}/${Number(m)}/${Number(d)}`;
}

function StalenessBadge({ days }: { days: number }) {
  if (days < 30) return null;
  if (days < 60) {
    return (
      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
        {days}日前
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      {days}日前
    </span>
  );
}

export function GymVisitHistory({ logs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const today = getTodayJST();

  const actuals = logs.filter((l) => l.type === "実績");

  // ジム別集計
  const gymMap: Record<string, { count: number; lastDate: string }> = {};
  actuals.forEach((l) => {
    if (!gymMap[l.gym_name]) {
      gymMap[l.gym_name] = { count: 0, lastDate: l.date };
    }
    gymMap[l.gym_name].count++;
    if (l.date > gymMap[l.gym_name].lastDate) {
      gymMap[l.gym_name].lastDate = l.date;
    }
  });

  const gyms: GymSummary[] = Object.entries(gymMap)
    .map(([gymName, { count, lastDate }]) => ({
      gymName,
      totalCount: count,
      lastVisit: lastDate,
      daysSinceLastVisit: daysDiff(lastDate, today),
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  if (gyms.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Building2 size={15} className="text-orange-500" />
          ジム訪問履歴
        </h3>
        <p className="text-center text-sm text-gray-400 py-4">訪問履歴はありません</p>
      </div>
    );
  }

  const visible = expanded ? gyms : gyms.slice(0, DEFAULT_SHOW);
  const hasMore = gyms.length > DEFAULT_SHOW;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <Building2 size={15} className="text-orange-500" />
        ジム訪問履歴
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {visible.map((gym) => (
          <div
            key={gym.gymName}
            className="bg-gray-50 rounded-xl p-3 border border-gray-100"
          >
            <div className="text-sm font-semibold text-gray-800 break-words leading-snug">{gym.gymName}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-lg font-bold text-orange-500">{gym.totalCount}</span>
              <span className="text-xs text-gray-500">回</span>
              <StalenessBadge days={gym.daysSinceLastVisit} />
            </div>
            <div className="mt-1">
              <span className="text-[10px] text-gray-400 block">
                最終訪問日 {formatDateYMD(gym.lastVisit)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 text-xs text-orange-500 font-medium py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
        >
          {expanded ? "閉じる" : `もっと見る（残り${gyms.length - DEFAULT_SHOW}件）`}
        </button>
      )}
    </div>
  );
}
