"use client";

import { ExternalLink } from "lucide-react";
import { formatMMDD } from "@/lib/utils";
import type { GymMaster, ClimbingLog, SetSchedule } from "@/lib/supabase/queries";

type Props = {
  gym: GymMaster;
  targetDate: string;
  distanceKm?: number | null;
  latestSchedule?: SetSchedule;
  lastVisit?: string;
  setAge?: number;
  lastVisitDays?: number;
  friendLogsOnDate: ClimbingLog[];
  isSub?: boolean;
};

type Badge = { label: string; cls: string };

export function GymCard({
  gym,
  distanceKm,
  latestSchedule,
  lastVisit,
  setAge,
  lastVisitDays,
  friendLogsOnDate,
  isSub = false,
}: Props) {

  // バッジ計算
  const badges: Badge[] = [];

  if (setAge != null) {
    if (setAge <= 7)       badges.push({ label: "🔥 新セット",  cls: "bg-orange-100 text-orange-600" });
    else if (setAge <= 14) badges.push({ label: "✨ 準新セット", cls: "bg-yellow-100 text-yellow-700" });
  }

  if (lastVisit == null) {
    badges.push({ label: "🆕 未訪問", cls: "bg-blue-50 text-blue-500" });
  } else if (lastVisitDays != null && lastVisitDays >= 30) {
    badges.push({ label: "⌛ ごぶさた", cls: "bg-red-50 text-red-500" });
  }

  // 最終訪問ラベル
  const lastVisitLabel = (() => {
    if (lastVisit == null) return null;
    if (lastVisitDays === 0) return "今日";
    if (lastVisitDays === 1) return "昨日";
    if (lastVisitDays != null && lastVisitDays <= 6)  return `${lastVisitDays}日前`;
    if (lastVisitDays != null && lastVisitDays <= 60) return `${Math.floor(lastVisitDays / 7)}週間前`;
    if (lastVisitDays != null)                        return `${Math.floor(lastVisitDays / 30)}ヶ月前`;
    return null;
  })();

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${isSub ? "opacity-75" : ""}`}>
      {/* ヘッダー */}
      <div className="px-4 pt-3.5 pb-2">
        {/* ジム名行 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{gym.gym_name}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-gray-400">{gym.area_tag}</span>
              {distanceKm != null && typeof distanceKm === "number" && isFinite(distanceKm) && (
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
        {(badges.length > 0 || friendLogsOnDate.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {badges.map((b) => (
              <span key={b.label} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>
                {b.label}
              </span>
            ))}
            {friendLogsOnDate.map((l) => (
              <span key={l.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                👥 {l.user}{l.time_slot ? ` ${l.time_slot}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        {/* セット情報 */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-1 min-w-0 truncate">
          <span className="flex-shrink-0">📅</span>
          {latestSchedule ? (
            <span className="truncate">
              {formatMMDD(latestSchedule.start_date)}〜
              {latestSchedule.end_date ? formatMMDD(latestSchedule.end_date) : ""}
              {setAge != null && (
                <span className={`ml-1 font-medium ${
                  setAge <= 7 ? "text-orange-500" : setAge <= 14 ? "text-yellow-600" : "text-gray-400"
                }`}>
                  ({setAge}日目)
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-300">スケジュール未登録</span>
          )}
        </div>

        {/* 最終訪問 */}
        <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
          <span>🕐</span>
          {lastVisitLabel ? (
            <span className={lastVisitDays != null && lastVisitDays >= 30 ? "text-red-400 font-medium" : "text-gray-500"}>
              {lastVisitLabel}
              {lastVisit && <span className="text-gray-300 ml-1">({formatMMDD(lastVisit)})</span>}
            </span>
          ) : (
            <span className="text-gray-300">未訪問</span>
          )}
        </div>
      </div>
    </div>
  );
}
