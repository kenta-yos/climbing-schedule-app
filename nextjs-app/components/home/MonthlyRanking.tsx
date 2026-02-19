"use client";

import { getNowJST } from "@/lib/utils";
import { RANK_MEDALS } from "@/lib/constants";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  users: User[];
  currentUser: string;
};

type RankedUser = {
  userName: string;
  count: number;
  rank: number;
  user: User | undefined;
};

export function MonthlyRanking({ logs, users, currentUser }: Props) {
  const now = getNowJST();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  // 今月の実績のみ
  const thisMonthLogs = logs.filter(
    (l) => l.type === "実績" && l.date.startsWith(monthStr)
  );

  // ユーザーごとの集計
  const countMap: Record<string, number> = {};
  thisMonthLogs.forEach((l) => {
    countMap[l.user] = (countMap[l.user] || 0) + 1;
  });

  if (Object.keys(countMap).length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <div className="text-3xl mb-2">🏆</div>
        <p className="text-sm">今月はまだ実績がありません</p>
      </div>
    );
  }

  const userMap = Object.fromEntries(users.map((u) => [u.user_name, u]));

  // ランキング生成（同数は同位）
  const sorted = Object.entries(countMap).sort(([, a], [, b]) => b - a);
  const ranked: RankedUser[] = [];
  let currentRank = 1;
  sorted.forEach(([userName, count], i) => {
    if (i > 0 && count < sorted[i - 1][1]) {
      currentRank = i + 1;
    }
    ranked.push({ userName, count, rank: currentRank, user: userMap[userName] });
  });

  return (
    <div className="space-y-2">
      {ranked.map(({ userName, count, rank, user }) => {
        const isMe = userName === currentUser;
        const medal = RANK_MEDALS[rank];

        return (
          <div
            key={userName}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
              isMe
                ? "bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200"
                : "bg-white border border-gray-100"
            }`}
          >
            {/* ランク */}
            <div className="w-8 text-center flex-shrink-0">
              {medal ? (
                <span className="text-xl">{medal}</span>
              ) : (
                <span className="text-sm font-bold text-gray-400">{rank}位</span>
              )}
            </div>

            {/* ユーザー */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
              style={{ backgroundColor: user?.color || "#999" }}
            >
              {user?.icon || "?"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-sm font-semibold ${isMe ? "text-orange-700" : "text-gray-800"}`}>
                  {userName}
                </span>
                {isMe && (
                  <span className="text-xs text-orange-500">（あなた）</span>
                )}
              </div>
            </div>

            {/* 回数 */}
            <div className="flex-shrink-0 text-right">
              <span
                className={`text-lg font-bold ${rank === 1 ? "gradient-text" : "text-gray-700"}`}
              >
                {count}
              </span>
              <span className="text-xs text-gray-500 ml-0.5">回</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
