"use client";

import Image from "next/image";
import { Instagram } from "lucide-react";
import { TIME_SLOTS } from "@/lib/constants";
import type { GymMaster, ClimbingLog, SetSchedule, User } from "@/lib/supabase/queries";

type Props = {
  gym: GymMaster;
  targetDate: string;
  distanceKm?: number | null;
  latestSchedule?: SetSchedule;
  lastVisit?: string;
  setAge?: number;
  lastVisitDays?: number;
  friendLogsOnDate: ClimbingLog[];
  users: User[];
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
  users,
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

  // 最終登攀日（先頭10文字＝YYYY-MM-DD のみ使う）
  const lastVisitDate = lastVisit ? lastVisit.slice(0, 10) : null;
  const lastVisitFull = lastVisitDate ? lastVisitDate.replace(/-/g, "/") : null;

  // 時間帯アイコンパス（/images/hiru.png 等）
  const getTimeIcon = (timeSlot: string | null): string | null => {
    if (!timeSlot) return null;
    return TIME_SLOTS.find((s) => s.value === timeSlot)?.icon ?? null;
  };

  // ユーザー情報（icon は絵文字テキスト、color は hex カラー）
  const getUserInfo = (userName: string): User | undefined =>
    users.find((u) => u.user_name === userName);

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
              <Instagram size={14} />
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
            {/* 仲間バッジ：絵文字アイコン（背景色付き丸）＋ 時間帯画像アイコン */}
            {friendLogsOnDate.map((l) => {
              const user = getUserInfo(l.user);
              const timeIcon = getTimeIcon(l.time_slot);
              return (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-100"
                >
                  {/* ユーザーアイコン（絵文字 + カラー背景丸） */}
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                    style={{ backgroundColor: user?.color ?? "#9ca3af" }}
                  >
                    {user?.icon ?? l.user.slice(0, 1)}
                  </span>
                  {/* 時間帯アイコン（画像） */}
                  {timeIcon && (
                    <Image
                      src={timeIcon}
                      alt={l.time_slot ?? ""}
                      width={14}
                      height={14}
                      className="object-contain flex-shrink-0"
                    />
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        {/* セット情報（完了日のみ） */}
        <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-1 min-w-0">
          <span className="flex-shrink-0">📅</span>
          {latestSchedule ? (
            <span>
              {latestSchedule.end_date
                ? latestSchedule.end_date.slice(0, 10).replace(/-/g, "/")
                : latestSchedule.start_date.slice(0, 10).replace(/-/g, "/")}
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

        {/* 最終登攀日 */}
        <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
          <span>🕐</span>
          {lastVisitFull ? (
            <span className={lastVisitDays != null && lastVisitDays >= 30 ? "text-red-400 font-medium" : "text-gray-500"}>
              {lastVisitFull}
            </span>
          ) : (
            <span className="text-gray-300">未登攀</span>
          )}
        </div>
      </div>
    </div>
  );
}
