"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addClimbingLog,
  updateClimbingLog,
  deleteClimbingLog,
  updateClimbingLogsBulk,
  getCompanionConflicts,
  checkDuplicateLog,
} from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { trackAction } from "@/lib/analytics";
import { revalidateSchedulePages } from "@/lib/actions";
import { getTodayJST, formatMMDD } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { GymMaster, ClimbingLog, User } from "@/lib/supabase/queries";
import Image from "next/image";
import { ChevronLeft, Search, X, Trash2, Loader2 } from "lucide-react";

// ジム未定のときの内部値・DB保存値
export const GYM_UNDECIDED = "__undecided__";
export const GYM_UNDECIDED_LABEL = "ジム未定";

type Props = {
  userName: string;
  gyms: GymMaster[];
  recentGymNames: string[];
  myPlans?: ClimbingLog[];
  editLog?: ClimbingLog;
  groupMembers?: ClimbingLog[];
  users?: User[];
};

export function PlanPageClient({
  userName,
  gyms,
  recentGymNames,
  myPlans = [],
  editLog,
  groupMembers = [],
  users = [],
}: Props) {
  const router = useRouter();
  const isEdit = !!editLog;

  // 初期値：編集モードなら既存データ、新規なら空
  const [date, setDate] = useState(editLog ? editLog.date.split("T")[0] : getTodayJST());
  const [timeSlot, setTimeSlot] = useState<string>(editLog?.time_slot ?? "夜");
  const [selectedGym, setSelectedGym] = useState<string>(
    editLog
      ? (editLog.gym_name === GYM_UNDECIDED_LABEL ? GYM_UNDECIDED : editLog.gym_name)
      : ""
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 一緒に登る人：編集モードは既存グループメンバーを初期選択
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>(
    isEdit ? groupMembers.map((m) => m.user) : []
  );
  // 友人（アプリ外）フラグ
  const [withFriends, setWithFriends] = useState<boolean>(
    editLog?.with_friends ?? false
  );

  // 編集モードで元々グループにいたメンバーはロック（外せない）
  const lockedCompanions = isEdit ? new Set(groupMembers.map((m) => m.user)) : new Set<string>();

  const toggleCompanion = (userId: string) => {
    if (lockedCompanions.has(userId)) return;
    setSelectedCompanions((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // 検索フィルター
  const filteredGyms = searchQuery.trim()
    ? gyms.filter((g) =>
        g.gym_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  // よく行くジム（最大6件）
  const recentGyms = recentGymNames
    .map((name) => gyms.find((g) => g.gym_name === name))
    .filter((g): g is GymMaster => !!g)
    .slice(0, 6);

  const handleSelectGym = (gymName: string, source: "undecided" | "recent" | "search") => {
    trackAction(userName, "plan", `gym_selected_${source}`);
    setSelectedGym(gymName);
    setSearchQuery("");
  };

  // 表示ラベル
  const selectedGymLabel =
    selectedGym === GYM_UNDECIDED ? GYM_UNDECIDED_LABEL : selectedGym;

  // DB保存用ジム名
  const gymNameForDB =
    selectedGym === GYM_UNDECIDED ? GYM_UNDECIDED_LABEL : selectedGym;

  const handleSubmit = async (type: "予定" | "実績") => {
    if (!selectedGym) {
      toast({ title: "ジムを選択してください", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "日付を選択してください", variant: "destructive" });
      return;
    }

    if (isEdit && editLog) {
      setSubmitting(true);
      try {
        // 自分のログを更新
        await updateClimbingLog(editLog.id, {
          date,
          gym_name: gymNameForDB,
          time_slot: timeSlot as "昼" | "夕方" | "夜",
          with_friends: withFriends,
        });

        // 元々のグループメンバーのうち、まだ選択されているメンバーのログも更新
        const originalGroupByUser: Record<string, ClimbingLog> = {};
        for (const m of groupMembers) {
          originalGroupByUser[m.user] = m;
        }
        const originalUserNames = groupMembers.map((m) => m.user);

        const stillSelectedFromGroup = groupMembers.filter((m) =>
          selectedCompanions.includes(m.user)
        );
        if (stillSelectedFromGroup.length > 0) {
          await updateClimbingLogsBulk(
            stillSelectedFromGroup.map((m) => m.id),
            { date, gym_name: gymNameForDB, time_slot: timeSlot as "昼" | "夕方" | "夜" }
          );
        }

        // 新たに追加された仲間（元グループにいなかった人）のログを作成
        const newCompanions = selectedCompanions.filter(
          (name) => !originalUserNames.includes(name)
        );
        if (newCompanions.length > 0) {
          const conflicting = await getCompanionConflicts(
            newCompanions, date, gymNameForDB, "予定", timeSlot
          );
          if (conflicting.length > 0) {
            toast({
              title: `${conflicting.join("・")}さんはすでにこの日・ジム・時間帯のログがあります`,
              variant: "destructive",
            });
            setSubmitting(false);
            return;
          }
          await Promise.all(
            newCompanions.map((companion) =>
              addClimbingLog({
                date,
                gym_name: gymNameForDB,
                user: companion,
                type: "予定",
                time_slot: timeSlot as "昼" | "夕方" | "夜",
                with_friends: false,
              })
            )
          );
        }

        trackAction(userName, "plan", "plan_updated");
        toast({ title: "📅 予定を更新しました！", variant: "success" as any });
        await revalidateSchedulePages();
        router.push("/home");
      } catch (err) {
        console.error(err);
        toast({ title: "更新に失敗しました", variant: "destructive" });
        setSubmitting(false);
      }
    } else {
      // 新規登録：自分の重複チェック（予定・実績どちらも）
      const isDuplicate = await checkDuplicateLog(userName, date, timeSlot, type);
      if (isDuplicate) {
        toast({
          title: type === "予定"
            ? "🙈 同じ予定がもうすでにあるよ！"
            : "🙈 同じ日・ジム・時間帯の実績がもうすでにあるよ！",
          variant: "destructive",
        });
        return;
      }
      // 仲間の重複チェック
      if (selectedCompanions.length > 0) {
        const conflicting = await getCompanionConflicts(
          selectedCompanions, date, gymNameForDB, type, timeSlot
        );
        if (conflicting.length > 0) {
          toast({
            title: `${conflicting.join("・")}さんはすでにこの日・ジム・時間帯のログがあります`,
            variant: "destructive",
          });
          return;
        }
      }
      setSubmitting(true);
      try {
        await Promise.all([
          addClimbingLog({
            date,
            gym_name: gymNameForDB,
            user: userName,
            type,
            time_slot: timeSlot as "昼" | "夕方" | "夜",
            with_friends: withFriends,
          }),
          ...selectedCompanions.map((companion) =>
            addClimbingLog({
              date,
              gym_name: gymNameForDB,
              user: companion,
              type,
              time_slot: timeSlot as "昼" | "夕方" | "夜",
              with_friends: false,
            })
          ),
        ]);
        const companionNames: string[] = [];
        if (selectedCompanions.length > 0) companionNames.push(...selectedCompanions);
        if (withFriends) companionNames.push("友人");
        const companionMsg = companionNames.length > 0
          ? `（${companionNames.join("・")}と）`
          : "";
        toast({
          title: type === "予定"
            ? `📅 予定を登録しました！${companionMsg}`
            : `🧗 実績を登録しました！${companionMsg}`,
          variant: "success" as any,
        });
        await revalidateSchedulePages();
        router.push("/home");
      } catch (err) {
        console.error(err);
        toast({ title: "登録に失敗しました", variant: "destructive" });
        setSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!editLog) return;
    setDeleting(true);
    try {
      await deleteClimbingLog(editLog.id);
      trackAction(userName, "plan", "plan_deleted");
      toast({ title: "🗑️ 予定を削除しました", variant: "success" as any });
      await revalidateSchedulePages();
      router.push("/home");
    } catch (err) {
      console.error(err);
      toast({ title: "削除に失敗しました", variant: "destructive" });
      setDeleting(false);
    }
  };

  // 「一緒に登る人」セクションを表示するか
  const otherUsers = users.filter((u) => u.user_name !== userName);
  const showCompanions = otherUsers.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ヘッダー safe-area-top対応 */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-600" />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {isEdit ? "予定を編集する" : "クライミングの予定を入れる"}
        </h1>
        {isEdit && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            {deleting ? (
              <div className="w-5 h-5 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={20} />
            )}
          </button>
        )}
      </div>

      {/* スクロールコンテンツ */}
      <div
        className="flex-1 overflow-y-auto px-4 py-5 space-y-6"
        style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
      >
        {/* 日付 */}
        <section>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            📅 日付
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-base bg-white"
          />
        </section>

        {/* 時間帯 */}
        <section>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            🕐 時間帯
          </label>
          <div className="flex gap-3">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                onClick={() => setTimeSlot(slot.value)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all duration-150 active:scale-95 ${
                  timeSlot === slot.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Image
                  src={slot.icon}
                  alt={slot.label}
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <span
                  className={`text-sm font-medium ${
                    timeSlot === slot.value ? "text-orange-600" : "text-gray-600"
                  }`}
                >
                  {slot.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ジム選択 */}
        <section>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            🏢 ジム選択
          </label>

          {selectedGym ? (
            /* 選択済み */
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border-2 border-orange-300 rounded-2xl">
              <span className="text-sm font-semibold text-orange-700 flex-1">
                ✅ {selectedGymLabel}
              </span>
              <button
                onClick={() => setSelectedGym("")}
                className="p-1 rounded-full hover:bg-orange-100 transition-colors"
              >
                <X size={18} className="text-orange-400" />
              </button>
            </div>
          ) : (
            <>
              {/* ジム未定ボタン */}
              <button
                onClick={() => handleSelectGym(GYM_UNDECIDED, "undecided")}
                className="w-full text-left px-4 py-3 mb-3 rounded-xl border-2 border-dashed border-gray-300 bg-white text-sm font-medium text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-150 active:scale-[0.98] flex items-center gap-2"
              >
                <span className="text-lg">🤷</span>
                <span>どこか登ろう〜でとりあえず登録</span>
              </button>

              {/* 検索ボックス */}
              <div className="relative mb-4">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <Input
                  type="text"
                  placeholder="ジム名を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-base bg-white h-12 rounded-xl"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                )}
              </div>

              {/* 検索結果 or よく行くジム */}
              {searchQuery.trim() ? (
                <div className="space-y-1.5">
                  {filteredGyms.length > 0 ? (
                    filteredGyms.map((gym) => (
                      <button
                        key={gym.gym_name}
                        onClick={() => handleSelectGym(gym.gym_name, "search")}
                        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all duration-150 active:scale-[0.98]"
                      >
                        {recentGymNames.includes(gym.gym_name) && (
                          <span className="mr-1">⭐</span>
                        )}
                        {gym.gym_name}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">
                      該当するジムが見つかりません
                    </p>
                  )}
                </div>
              ) : (
                recentGyms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">⭐ よく行くジム</p>
                    <div className="space-y-1.5">
                      {recentGyms.map((gym) => (
                        <button
                          key={gym.gym_name}
                          onClick={() => handleSelectGym(gym.gym_name, "recent")}
                          className="w-full text-left px-4 py-3 rounded-xl border border-orange-200 bg-orange-50/60 text-sm font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50 transition-all duration-150 active:scale-[0.98]"
                        >
                          {gym.gym_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </section>

        {/* 一緒に登る人 */}
        {showCompanions && (
          <section>
            <label className="text-sm font-semibold text-gray-700 block mb-3">
              👥 一緒に登る人{" "}
              <span className="text-xs font-normal text-gray-400">（任意）</span>
            </label>
            <div className="flex flex-wrap gap-5">
              {/* アプリ内ユーザー */}
              {otherUsers.map((u) => {
                const isSelected = selectedCompanions.includes(u.user_name);
                const isLocked = lockedCompanions.has(u.user_name);
                return (
                  <button
                    key={u.user_name}
                    type="button"
                    onClick={() => toggleCompanion(u.user_name)}
                    className={`flex flex-col items-center gap-1.5 ${isLocked ? "cursor-default" : ""}`}
                  >
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-150 ${
                        isLocked
                          ? "ring-2 ring-gray-300 ring-offset-2"
                          : isSelected
                          ? "ring-4 ring-orange-400 ring-offset-2 scale-110 shadow-md"
                          : "opacity-40"
                      }`}
                      style={{ backgroundColor: u.color || "#94a3b8" }}
                    >
                      {u.icon || "🧗"}
                    </div>
                    <span
                      className={`text-[11px] font-medium leading-none ${
                        isLocked
                          ? "text-gray-400"
                          : isSelected
                          ? "text-orange-600"
                          : "text-gray-400"
                      }`}
                    >
                      {u.user_name}
                    </span>
                    {isLocked && (
                      <span className="text-[9px] text-gray-300 leading-none -mt-0.5">
                        参加中
                      </span>
                    )}
                  </button>
                );
              })}

              {/* 友人（アプリ外）トグル */}
              <button
                type="button"
                onClick={() => setWithFriends((prev) => !prev)}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-150 bg-gray-100 ${
                    withFriends
                      ? "ring-4 ring-orange-400 ring-offset-2 scale-110 shadow-md"
                      : "opacity-40"
                  }`}
                >
                  🙋
                </div>
                <span
                  className={`text-[11px] font-medium leading-none ${
                    withFriends ? "text-orange-600" : "text-gray-400"
                  }`}
                >
                  友人
                </span>
              </button>
            </div>
          </section>
        )}
      </div>

      {/* 登録/保存ボタン（固定） safe-area-bottom対応 */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          {isEdit ? (
            <Button
              onClick={() => handleSubmit("予定")}
              disabled={submitting}
              variant="climbing"
              className="flex-1 h-14 text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  保存中…
                </>
              ) : (
                "💾 変更を保存"
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => handleSubmit("予定")}
                disabled={submitting}
                variant="climbing-outline"
                className="flex-1 h-14 text-base font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    登録中…
                  </>
                ) : (
                  "📅 登るよ（予定）"
                )}
              </Button>
              <Button
                onClick={() => handleSubmit("実績")}
                disabled={submitting}
                variant="climbing"
                className="flex-1 h-14 text-base font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    登録中…
                  </>
                ) : (
                  "🧗 登った！"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
