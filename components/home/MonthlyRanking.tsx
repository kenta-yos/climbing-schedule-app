"use client";

import { useState } from "react";
import { getNowJST, formatMMDD } from "@/lib/utils";
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

// ユーザーの詳細ログパネル
function UserLogDetail({
  userName,
  logs,
  monthStr,
  user,
}: {
  userName: string;
  logs: ClimbingLog[];
  monthStr: string;
  user: User | undefined;
}) {
  const myLogs = logs
    .filter((l) => l.type === "実績" && l.user === userName && l.date.startsWith(monthStr))
    .sort((a, b) => b.date.localeCompare(a.date));

  // ジム別集計
  const gymCount: Record<string, number> = {};
  myLogs.forEach((l) => {
    gymCount[l.gym_name] = (gymCount[l.gym_name] || 0) + 1;
  });
  const gymEntries = Object.entries(gymCount).sort(([, a], [, b]) => b - a);

  // 月表示
  const [year, mon] = monthStr.split("-");
  const monthLabel = `${year}年${Number(mon)}月`;

  return (
    <div className="mt-2 pt-3 border-t border-gray-100 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
          style={{ backgroundColor: user?.color || "#999" }}
        >
          {user?.icon || "?"}
        </div>
        <span className="text-xs text-gray-500">
          {monthLabel}の記録
          <span className="ml-1 font-bold text-gray-700">{myLogs.length}回</span>
        </span>
      </div>

      {/* ジム別バブル */}
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

      {/* 日付別リスト */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {myLogs.map((log) => (
          <div
            key={log.id}
            className="flex items-center gap-2 py-1 text-xs text-gray-600"
          >
            <span className="w-10 font-medium text-gray-500 flex-shrink-0">
              {formatMMDD(log.date)}
            </span>
            <span className="w-0.5 h-3 rounded-full bg-orange-300 flex-shrink-0" />
            <span className="truncate">{log.gym_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyRanking({ logs, users, currentUser }: Props) {
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [tab, setTab] = useState<"thisMonth" | "lastMonth">("thisMonth");

  const now = getNowJST();
  const year = now.getFullYear();
  const month = now.getMonth();
  const thisMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  // 先月
  const lastMonthDate = new Date(year, month - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const monthStr = tab === "thisMonth" ? thisMonthStr : lastMonthStr;

  // 選択月の実績のみ
  const thisMonthLogs = logs.filter(
    (l) => l.type === "実績" && l.date.startsWith(monthStr)
  );

  // ユーザーごとの集計
  const countMap: Record<string, number> = {};
  thisMonthLogs.forEach((l) => {
    countMap[l.user] = (countMap[l.user] || 0) + 1;
  });

  const tabLabel = tab === "thisMonth" ? "今月" : "先月";

  // タブUI
  const tabBar = (
    <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
      <button
        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          tab === "thisMonth"
            ? "bg-white text-orange-600 shadow-sm"
            : "text-gray-500"
        }`}
        onClick={() => { setTab("thisMonth"); setOpenUser(null); }}
      >
        今月
      </button>
      <button
        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          tab === "lastMonth"
            ? "bg-white text-orange-600 shadow-sm"
            : "text-gray-500"
        }`}
        onClick={() => { setTab("lastMonth"); setOpenUser(null); }}
      >
        先月
      </button>
    </div>
  );

  if (Object.keys(countMap).length === 0) {
    return (
      <div>
        {tabBar}
        <div className="text-center py-6 text-gray-400">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-sm">{tabLabel}はまだ実績がありません</p>
        </div>
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
    <div>
      {tabBar}
      <div className="space-y-2">
      {ranked.map(({ userName, count, rank, user }) => {
        const isMe = userName === currentUser;
        const medal = RANK_MEDALS[rank];
        const isOpen = openUser === userName;

        return (
          <div
            key={userName}
            className={`px-4 py-3 rounded-2xl transition-all ${
              isMe
                ? "bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200"
                : "bg-white border border-gray-100"
            }`}
          >
            {/* メイン行：タップで詳細トグル */}
            <button
              className="w-full flex items-center gap-3 text-left"
              onClick={() => setOpenUser(isOpen ? null : userName)}
            >
              {/* ランク */}
              <div className="w-8 text-center flex-shrink-0">
                {medal ? (
                  <span className="text-xl">{medal}</span>
                ) : (
                  <span className="text-sm font-bold text-gray-400">{rank}位</span>
                )}
              </div>

              {/* アバター */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
                style={{ backgroundColor: user?.color || "#999" }}
              >
                {user?.icon || "?"}
              </div>

              {/* 名前 */}
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

              {/* 回数 + 展開インジケーター */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <span className={`text-lg font-bold ${rank === 1 ? "gradient-text" : "text-gray-700"}`}>
                    {count}
                  </span>
                  <span className="text-xs text-gray-500 ml-0.5">回</span>
                </div>
                <span className={`text-gray-300 text-sm transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </div>
            </button>

            {/* 詳細パネル（アコーディオン） */}
            {isOpen && (
              <UserLogDetail
                userName={userName}
                logs={logs}
                monthStr={monthStr}
                user={user}
              />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
