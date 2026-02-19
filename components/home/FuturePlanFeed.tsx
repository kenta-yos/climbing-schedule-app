"use client";

import Image from "next/image";
import { formatMMDD, getNowJST } from "@/lib/utils";
import { TIME_SLOTS, FUTURE_DAYS } from "@/lib/constants";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  users: User[];
  currentUser: string;
};

// 日付でグループ化
function groupByDate(logs: ClimbingLog[]): Record<string, ClimbingLog[]> {
  return logs.reduce(
    (acc, log) => {
      const date = log.date.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    },
    {} as Record<string, ClimbingLog[]>
  );
}

// 曜日
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function FuturePlanFeed({ logs, users, currentUser }: Props) {
  const now = getNowJST();
  const today = now.toISOString().split("T")[0];
  const cutoff = new Date(now.getTime() + FUTURE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 今日以降FUTURE_DAYS日以内の予定のみ
  const futureLogs = logs
    .filter((l) => l.type === "予定" && l.date >= today && l.date <= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  const userMap = Object.fromEntries(users.map((u) => [u.user_name, u]));
  const grouped = groupByDate(futureLogs);
  const sortedDates = Object.keys(grouped).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm">まだ予定がありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedDates.map((dateStr) => {
        const date = new Date(dateStr + "T00:00:00+09:00");
        const weekday = WEEKDAYS[date.getDay()];
        const isToday = dateStr === today;
        const dayLogs = grouped[dateStr];

        return (
          <div key={dateStr} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {/* 日付ヘッダー */}
            <div
              className={`px-4 py-2 flex items-center gap-2 ${
                isToday ? "climbing-gradient" : "bg-gray-50"
              }`}
            >
              <span
                className={`text-sm font-bold ${isToday ? "text-white" : "text-gray-700"}`}
              >
                {formatMMDD(dateStr)}（{weekday}）
              </span>
              {isToday && (
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                  今日
                </span>
              )}
            </div>

            {/* ログリスト */}
            <div className="divide-y divide-gray-50">
              {dayLogs.map((log) => {
                const user = userMap[log.user];
                const isMe = log.user === currentUser;
                const slotInfo = TIME_SLOTS.find((s) => s.value === log.time_slot);

                return (
                  <div
                    key={log.id}
                    className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-orange-50/30" : ""}`}
                  >
                    {/* ユーザーアイコン */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
                      style={{ backgroundColor: user?.color || "#999" }}
                    >
                      {user?.icon || "?"}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {log.gym_name}
                        </span>
                        {isMe && (
                          <span className="text-xs text-orange-500 font-medium flex-shrink-0">
                            あなた
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{log.user}</span>
                    </div>

                    {/* 時間帯 */}
                    {slotInfo && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Image
                          src={slotInfo.icon}
                          alt={slotInfo.label}
                          width={18}
                          height={18}
                          className="object-contain"
                        />
                        <span className="text-xs text-gray-500">{slotInfo.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
