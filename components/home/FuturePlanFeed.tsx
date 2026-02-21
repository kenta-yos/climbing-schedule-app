"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatMMDD, getTodayJST, getTomorrowJST, getDateOffsetJST } from "@/lib/utils";
import { TIME_SLOTS, FUTURE_DAYS } from "@/lib/constants";
import { GYM_UNDECIDED_LABEL } from "@/components/home/PlanPageClient";
import { addClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { trackAction } from "@/lib/analytics";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

type Props = {
  logs: ClimbingLog[];
  users: User[];
  currentUser: string;
  onJoined: () => void; // 参加登録後のリフレッシュ
};

// 日付でグループ化
function groupByDate(logs: ClimbingLog[]): Record<string, ClimbingLog[]> {
  return logs.reduce((acc, log) => {
    const date = log.date.split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ClimbingLog[]>);
}

// 同日内をジムでグループ化
function groupByGym(logs: ClimbingLog[]): Record<string, ClimbingLog[]> {
  return logs.reduce((acc, log) => {
    if (!acc[log.gym_name]) acc[log.gym_name] = [];
    acc[log.gym_name].push(log);
    return acc;
  }, {} as Record<string, ClimbingLog[]>);
}

const TIME_SLOT_ORDER: Record<string, number> = { 昼: 0, 夕方: 1, 夜: 2 };
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function gymDisplayName(name: string): string {
  return name === GYM_UNDECIDED_LABEL ? "🤷 どこか登ろう〜" : `🏢 ${name}`;
}

// 参加ミニUIコンポーネント
function JoinPanel({
  date,
  gymName,
  currentUser,
  existingLogs, // このジム+日のログ一覧（重複チェック用）
  onCancel,
  onJoined,
}: {
  date: string;
  gymName: string;
  currentUser: string;
  existingLogs: ClimbingLog[];
  onCancel: () => void;
  onJoined: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string>("夜");
  const [submitting, setSubmitting] = useState(false);

  const handleJoin = async () => {
    // 二重登録チェック：同日・同ジム・同時間帯で自分の予定がすでにある
    const duplicate = existingLogs.find(
      (l) =>
        l.user === currentUser &&
        l.type === "予定" &&
        l.date.split("T")[0] === date &&
        l.gym_name === gymName &&
        l.time_slot === selectedSlot
    );
    if (duplicate) {
      toast({
        title: "🙈 もうすでに登録してるよ！",
        variant: "destructive",
      });
      onCancel();
      return;
    }

    setSubmitting(true);
    try {
      await addClimbingLog({
        date,
        gym_name: gymName,
        user: currentUser,
        type: "予定",
        time_slot: selectedSlot as "昼" | "夕方" | "夜",
      });
      toast({ title: "📅 参加登録しました！", variant: "success" as any });
      trackAction(currentUser, "home", "plan_joined");
      onJoined();
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-orange-100">
      {/* 時間帯選択 */}
      <p className="text-[10px] text-gray-400 mb-1.5">時間帯を選んで参加</p>
      <div className="flex gap-2 mb-2">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot.value}
            onClick={() => setSelectedSlot(slot.value)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all active:scale-95 ${
              selectedSlot === slot.value
                ? "border-orange-400 bg-orange-50"
                : "border-gray-200 bg-white"
            }`}
          >
            <Image src={slot.icon} alt={slot.label} width={20} height={20} className="object-contain" />
            <span className={`text-[10px] font-medium ${selectedSlot === slot.value ? "text-orange-600" : "text-gray-500"}`}>
              {slot.label}
            </span>
          </button>
        ))}
      </div>
      {/* 確定・キャンセル */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
        >
          キャンセル
        </button>
        <button
          onClick={handleJoin}
          disabled={submitting}
          className="flex-1 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-60"
        >
          {submitting ? "登録中…" : "✅ 参加する"}
        </button>
      </div>
    </div>
  );
}

export function FuturePlanFeed({ logs, users, currentUser, onJoined }: Props) {
  const router = useRouter();
  // 展開中のジムキー（"日付|ジム名"）
  const [openJoinKey, setOpenJoinKey] = useState<string | null>(null);
  // 編集ページへ遷移中のlogId
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEditNavigate = useCallback((logId: string) => {
    trackAction(currentUser, "home", "edit_tapped");
    setEditingId(logId);
    router.refresh();
    router.push(`/home/plan?editId=${logId}`);
  }, [router, currentUser]);

  // 参加登録後：SSRキャッシュもリフレッシュしてからデータ再取得
  const handleJoined = useCallback(() => {
    router.refresh();
    onJoined();
  }, [router, onJoined]);

  const today = getTodayJST();
  const tomorrow = getTomorrowJST();
  const cutoff = getDateOffsetJST(FUTURE_DAYS);

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
        const isTomorrow = dateStr === tomorrow;
        const dayLogs = grouped[dateStr];

        // カード・ヘッダーのスタイルを日付で切り替え
        const cardClass = isToday
          ? "bg-white rounded-2xl overflow-hidden shadow-md border-2 border-orange-300"
          : isTomorrow
          ? "bg-white rounded-2xl overflow-hidden shadow-sm border-2 border-blue-200"
          : "bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100";

        const headerClass = isToday
          ? "px-4 py-2.5 flex items-center gap-2 climbing-gradient"
          : isTomorrow
          ? "px-4 py-2.5 flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500"
          : "px-4 py-2 flex items-center gap-2 bg-gray-50";

        const dateTextClass = isToday || isTomorrow ? "text-sm font-bold text-white" : "text-sm font-bold text-gray-500";

        return (
          <div key={dateStr} className={cardClass}>
            {/* 日付ヘッダー */}
            <div className={headerClass}>
              <span className={dateTextClass}>
                {formatMMDD(dateStr)}（{weekday}）
              </span>
              {isToday && (
                <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-bold">今日</span>
              )}
              {isTomorrow && (
                <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-bold">明日</span>
              )}
            </div>

            {/* ジムごと */}
            {(() => {
              const gymGroups = groupByGym(dayLogs);
              const gymNames = Object.keys(gymGroups).sort();
              return (
                <div className="divide-y divide-gray-50">
                  {gymNames.map((gymName) => {
                    const gymLogs = gymGroups[gymName];
                    const hasMe = gymLogs.some((l) => l.user === currentUser);
                    const joinKey = `${dateStr}|${gymName}`;
                    const isJoinOpen = openJoinKey === joinKey;

                    return (
                      <div key={gymName} className={`px-4 py-3 ${hasMe ? "bg-orange-50/40" : ""}`}>
                        {/* ジム名 + 参加ボタン */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {gymDisplayName(gymName)}
                          </span>
                          {/* 自分が未参加のときのみ「+ 参加」ボタン表示 */}
                          {!hasMe && !isJoinOpen && (
                            <button
                              onClick={() => { trackAction(currentUser, "home", "join_tapped"); setOpenJoinKey(joinKey); }}
                              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-orange-300 text-orange-500 text-xs font-semibold hover:bg-orange-50 active:scale-95 transition-all"
                            >
                              <span>＋</span>
                              <span>参加</span>
                            </button>
                          )}
                        </div>

                        {/* ユーザータグ一覧 */}
                        <div className="flex flex-wrap gap-1.5">
                          {[...gymLogs]
                            .sort((a, b) =>
                              (TIME_SLOT_ORDER[a.time_slot ?? ""] ?? 99) -
                              (TIME_SLOT_ORDER[b.time_slot ?? ""] ?? 99)
                            )
                            .map((log) => {
                              const user = userMap[log.user];
                              const isMe = log.user === currentUser;
                              const userSlot = TIME_SLOTS.find((s) => s.value === log.time_slot);
                              return (
                                <div
                                  key={log.id}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                    isMe
                                      ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  <span
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0"
                                    style={{ backgroundColor: user?.color || "#999" }}
                                  >
                                    {user?.icon || "?"}
                                  </span>
                                  <span>{log.user}</span>
                                  {userSlot && (
                                    <Image
                                      src={userSlot.icon}
                                      alt={userSlot.label}
                                      width={14}
                                      height={14}
                                      className="object-contain flex-shrink-0"
                                    />
                                  )}
                                  {isMe && (
                                    <button
                                      onClick={() => handleEditNavigate(log.id)}
                                      disabled={!!editingId}
                                      className="ml-0.5 leading-none flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40"
                                      aria-label="編集"
                                    >
                                      {editingId === log.id ? (
                                        <span className="inline-block w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        "✏️"
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                        </div>

                        {/* 参加ミニパネル */}
                        {isJoinOpen && (
                          <JoinPanel
                            date={dateStr}
                            gymName={gymName}
                            currentUser={currentUser}
                            existingLogs={logs}
                            onCancel={() => setOpenJoinKey(null)}
                            onJoined={() => {
                              setOpenJoinKey(null);
                              handleJoined();
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
