"use client";

import { ExternalLink } from "lucide-react";
import { formatMMDD, daysDiff, getNowJST } from "@/lib/utils";
import type { GymMaster, ClimbingLog, SetSchedule } from "@/lib/supabase/queries";
import type { GymScore } from "@/lib/scoring";

type Props = {
  gym: GymMaster;
  score: GymScore;
  myLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  friendLogsOnDate: ClimbingLog[]; // 選択日のfriendLogsのみ渡す
  distanceKm: number | null;       // null = 出発地未設定 or lat/lngなし
};

export function GymCard({
  gym, score, myLogs, setSchedules, friendLogsOnDate, distanceKm,
}: Props) {
  const now = getNowJST();

  // 最新セット
  const latestSchedule = setSchedules
    .filter((s) => s.gym_name === gym.gym_name)
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

  const setAge = latestSchedule
    ? daysDiff(new Date(latestSchedule.start_date), now)
    : null;

  // 最終訪問
  const myVisits = myLogs
    .filter((l) => l.gym_name === gym.gym_name && l.type === "実績")
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastVisit = myVisits[0]?.date ?? null;
  const lastVisitDays = lastVisit ? daysDiff(new Date(lastVisit), now) : null;

  // 選択日に来る仲間
  const friendsOnDate = friendLogsOnDate.filter(
    (l) => l.gym_name === gym.gym_name && l.type === "予定"
  );

  // セット新鮮度バッジ
  const freshBadge =
    setAge === null ? null
    : setAge <= 7 ? { label: "🔥 新セット", cls: "bg-orange-100 text-orange-600" }
    : setAge <= 14 ? { label: "✨ やや新鮮", cls: "bg-yellow-100 text-yellow-700" }
    : null;

  // スコアバッジ（理由から表示するもの）
  const badgesToShow = score.reasons.filter(
    (r) => r !== "🔥 新セット" && r !== "✨ やや新鮮"
  );

  // 最終訪問の表示
  const lastVisitLabel =
    lastVisitDays === null ? "未訪問"
    : lastVisitDays === 0 ? "今日"
    : lastVisitDays <= 6 ? `${lastVisitDays}日前`
    : lastVisitDays <= 13 ? `${Math.floor(lastVisitDays / 7)}週間前`
    : lastVisitDays <= 60 ? `${Math.floor(lastVisitDays / 7)}週間前`
    : `${Math.floor(lastVisitDays / 30)}ヶ月前`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* カードヘッダー */}
      <div className="px-4 pt-3.5 pb-2">
        {/* ジム名行 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{gym.gym_name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400">{gym.area_tag}</span>
              {distanceKm !== null && (
                <span className="text-[11px] font-medium text-blue-500">
                  📍 {distanceKm < 1
                    ? `${Math.round(distanceKm * 1000)}m`
                    : `${distanceKm.toFixed(1)}km`}
                </span>
              )}
            </div>
          </div>
          {gym.profile_url && (
            <a
              href={gym.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-300 hover:text-blue-400 transition-colors flex-shrink-0 -mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* バッジ行 */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {freshBadge && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${freshBadge.cls}`}>
              {freshBadge.label}
            </span>
          )}
          {badgesToShow.map((reason) => (
            <span key={reason} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {reason}
            </span>
          ))}
          {friendsOnDate.map((l) => (
            <span key={l.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              👥 {l.user}{l.time_slot ? ` ${l.time_slot}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* カードフッター */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        {/* セット情報 */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-1 min-w-0">
          <span>📅</span>
          {latestSchedule ? (
            <span>
              セット {formatMMDD(latestSchedule.start_date)}〜
              <span className={`ml-1 ${setAge !== null && setAge <= 7 ? "text-orange-500 font-semibold" : setAge !== null && setAge <= 14 ? "text-yellow-600 font-medium" : "text-gray-400"}`}>
                ({setAge !== null ? `${setAge}日目` : "-"})
              </span>
            </span>
          ) : (
            <span className="text-gray-300">スケジュール未登録</span>
          )}
        </div>

        {/* 最終訪問 */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
          <span>🕐</span>
          <span className={lastVisitDays === null ? "text-gray-300" : lastVisitDays > 30 ? "text-red-400" : "text-gray-500"}>
            {lastVisitLabel}
          </span>
          {lastVisit && (
            <span className="text-gray-300 text-[10px]">({formatMMDD(lastVisit)})</span>
          )}
        </div>
      </div>
    </div>
  );
}
