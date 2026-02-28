"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarDays } from "lucide-react";
import { getTodayJST, formatMMDD } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { ClimbingLog } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
};

const DEFAULT_SHOW = 3;

export function UpcomingPlans({ logs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const today = getTodayJST();

  const plans = logs
    .filter((l) => l.type === "予定" && l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <CalendarDays size={15} className="text-blue-500" />
          今後の予定
        </h3>
        <p className="text-center text-sm text-gray-400 py-4">予定はありません</p>
      </div>
    );
  }

  const visible = expanded ? plans : plans.slice(0, DEFAULT_SHOW);
  const hasMore = plans.length > DEFAULT_SHOW;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
        <CalendarDays size={15} className="text-blue-500" />
        今後の予定
      </h3>
      <div className="space-y-0">
        {visible.map((log) => {
          const slotInfo = TIME_SLOTS.find((s) => s.value === log.time_slot);
          return (
            <div
              key={log.id}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              <div className="w-10 text-center flex-shrink-0">
                <div className="text-xs font-semibold text-gray-700">{formatMMDD(log.date)}</div>
                {slotInfo && (
                  <Image
                    src={slotInfo.icon}
                    alt={slotInfo.label}
                    width={14}
                    height={14}
                    className="mx-auto mt-0.5 object-contain"
                  />
                )}
              </div>
              <div className="w-0.5 h-8 rounded-full bg-blue-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{log.gym_name}</div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 text-xs text-blue-500 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          {expanded ? "閉じる" : `もっと見る（残り${plans.length - DEFAULT_SHOW}件）`}
        </button>
      )}
    </div>
  );
}
