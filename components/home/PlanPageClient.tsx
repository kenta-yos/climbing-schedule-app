"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { getTodayJST } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { GymMaster } from "@/lib/supabase/queries";
import Image from "next/image";
import { ChevronLeft, Search, X } from "lucide-react";

type Props = {
  userName: string;
  gyms: GymMaster[];
  recentGymNames: string[];
};

export function PlanPageClient({ userName, gyms, recentGymNames }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(getTodayJST());
  const [timeSlot, setTimeSlot] = useState<string>("夜");
  const [selectedGym, setSelectedGym] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

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

  const handleSelectGym = (gymName: string) => {
    setSelectedGym(gymName);
    setSearchQuery("");
  };

  const handleSubmit = async (type: "予定" | "実績") => {
    if (!selectedGym) {
      toast({ title: "ジムを選択してください", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "日付を選択してください", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await addClimbingLog({
        date,
        gym_name: selectedGym,
        user: userName,
        type,
        time_slot: timeSlot as "昼" | "夕方" | "夜",
      });
      toast({
        title: type === "予定" ? "📅 予定を登録しました！" : "🧗 実績を登録しました！",
        variant: "success" as any,
      });
      router.push("/home");
    } catch (err) {
      console.error(err);
      toast({ title: "登録に失敗しました", variant: "destructive" });
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ヘッダー（固定） safe-area-top対応 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-600" />
        </button>
        <h1 className="text-base font-bold text-gray-900">クライミングの予定を入れる</h1>
      </div>

      {/* スクロールコンテンツ - 固定ボタン分の余白をsafe area込みで確保 */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6" style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}>

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

          {/* 選択済み */}
          {selectedGym ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border-2 border-orange-300 rounded-2xl">
              <span className="text-sm font-semibold text-orange-700 flex-1">
                ✅ {selectedGym}
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
                        onClick={() => handleSelectGym(gym.gym_name)}
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
                          onClick={() => handleSelectGym(gym.gym_name)}
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
      </div>

      {/* 登録ボタン（画面最下部に完全固定） safe-area-bottom対応 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            onClick={() => handleSubmit("予定")}
            disabled={submitting}
            variant="climbing-outline"
            className="flex-1 h-14 text-base font-semibold"
          >
            📅 登るよ（予定）
          </Button>
          <Button
            onClick={() => handleSubmit("実績")}
            disabled={submitting}
            variant="climbing"
            className="flex-1 h-14 text-base font-semibold"
          >
            🧗 登った！
          </Button>
        </div>
      </div>
    </div>
  );
}
