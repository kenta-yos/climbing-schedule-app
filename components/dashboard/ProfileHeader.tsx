"use client";

import { getNowJST } from "@/lib/utils";
import { RANK_MEDALS } from "@/lib/constants";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

type Props = {
  currentUser: string;
  users: User[];
  rankingLogs: ClimbingLog[];
};

function getRank(
  logs: ClimbingLog[],
  monthStr: string,
  userName: string
): { rank: number; count: number } | null {
  const monthLogs = logs.filter(
    (l) => l.type === "実績" && l.date.startsWith(monthStr)
  );
  const countMap: Record<string, number> = {};
  monthLogs.forEach((l) => {
    countMap[l.user] = (countMap[l.user] || 0) + 1;
  });

  const myCount = countMap[userName];
  if (!myCount) return null;

  const sorted = Object.values(countMap).sort((a, b) => b - a);
  let rank = 1;
  for (const c of sorted) {
    if (c === myCount) break;
    rank++;
  }
  return { rank, count: myCount };
}

function RankBadge({ label, rankInfo }: { label: string; rankInfo: { rank: number; count: number } | null }) {
  if (!rankInfo) {
    return (
      <span className="text-xs text-gray-400">
        {label} ランク外
      </span>
    );
  }
  const medal = RANK_MEDALS[rankInfo.rank];
  return (
    <span className="text-xs text-gray-600">
      {label}{" "}
      {medal ? (
        <span className="text-base">{medal}</span>
      ) : (
        <span className="font-bold">{rankInfo.rank}位</span>
      )}
    </span>
  );
}

export function ProfileHeader({ currentUser, users, rankingLogs }: Props) {
  const now = getNowJST();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const user = users.find((u) => u.user_name === currentUser);
  const thisMonthRank = getRank(rankingLogs, thisMonthStr, currentUser);
  const lastMonthRank = getRank(rankingLogs, lastMonthStr, currentUser);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl flex-shrink-0 shadow-sm"
          style={{ backgroundColor: user?.color || "#999" }}
        >
          {user?.icon || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-gray-900 truncate">{currentUser}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-gray-400 font-semibold tracking-wide">CLIMB-BAKA AWARD</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RankBadge label="先月" rankInfo={lastMonthRank} />
            <span className="text-gray-300 text-xs">→</span>
            <RankBadge label="今月" rankInfo={thisMonthRank} />
          </div>
        </div>
      </div>
    </div>
  );
}
