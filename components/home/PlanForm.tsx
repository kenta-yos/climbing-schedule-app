"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { getTodayJST } from "@/lib/utils";
import { TIME_SLOTS } from "@/lib/constants";
import type { GymMaster } from "@/lib/supabase/queries";
import Image from "next/image";
import { X, Search } from "lucide-react";

type Props = {
  userName: string;
  gyms: GymMaster[];
  areas?: unknown[]; // 互換性のため残すが未使用
  onSuccess: () => void;
  onClose: () => void;
  recentGymNames: string[];
};

export function PlanForm({ userName, gyms, onSuccess, onClose, recentGymNames }: Props) {
  const [date, setDate] = useState(getTodayJST());
  const [timeSlot, setTimeSlot] = useState<string>("夜");
  const [selectedGym, setSelectedGym] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // 検索フィルター結果
  const filteredGyms = searchQuery.trim()
    ? gyms.filter((g) =>
        g.gym_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  // よく行くジム（最近訪問・重複なし・最大6件）
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
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
      {/* ヘッダー（固定） */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900">クライミングの予定を入れる</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* スクロール可能エリア */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 min-h-0">
        {/* 日付 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            📅 日付
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-base"
          />
        </div>

        {/* 時間帯 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            🕐 時間帯
          </label>
          <div className="flex gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                onClick={() => setTimeSlot(slot.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border-2 transition-all duration-150 active:scale-95 ${
                  timeSlot === slot.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Image src={slot.icon} alt={slot.label} width={28} height={28} className="object-contain" />
                <span className={`text-xs font-medium ${timeSlot === slot.value ? "text-orange-600" : "text-gray-600"}`}>
                  {slot.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ジム選択 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            🧗 ジム選択
          </label>

          {/* 選択済み表示 */}
          {selectedGym ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-300 rounded-xl">
              <span className="text-sm font-semibold text-orange-700 flex-1">✅ {selectedGym}</span>
              <button
                onClick={() => setSelectedGym("")}
                className="p-0.5 rounded-full hover:bg-orange-100 transition-colors"
              >
                <X size={16} className="text-orange-400" />
              </button>
            </div>
          ) : (
            <>
              {/* 検索ボックス */}
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="ジム名を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
              </div>

              {/* 検索結果 */}
              {searchQuery.trim() ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredGyms.length > 0 ? (
                    filteredGyms.map((gym) => (
                      <button
                        key={gym.gym_name}
                        onClick={() => handleSelectGym(gym.gym_name)}
                        className="text-left px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all duration-150 active:scale-95"
                      >
                        {recentGymNames.includes(gym.gym_name) && <span className="mr-0.5">⭐</span>}
                        {gym.gym_name}
                      </button>
                    ))
                  ) : (
                    <p className="col-span-2 text-sm text-gray-400 text-center py-4">
                      該当するジムが見つかりません
                    </p>
                  )}
                </div>
              ) : (
                /* よく行くジム */
                recentGyms.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">⭐ よく行くジム</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {recentGyms.map((gym) => (
                        <button
                          key={gym.gym_name}
                          onClick={() => handleSelectGym(gym.gym_name)}
                          className="text-left px-3 py-2 rounded-xl border border-orange-200 bg-orange-50/50 text-xs font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50 transition-all duration-150 active:scale-95"
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
        </div>
      </div>

      {/* 固定ボタン（常に下部に表示） */}
      <div className="flex gap-3 pt-3 border-t border-gray-100 flex-shrink-0">
        <Button
          onClick={() => handleSubmit("予定")}
          disabled={submitting}
          variant="climbing-outline"
          className="flex-1 h-12 text-base"
        >
          📅 登るよ（予定）
        </Button>
        <Button
          onClick={() => handleSubmit("実績")}
          disabled={submitting}
          variant="climbing"
          className="flex-1 h-12 text-base"
        >
          🧗 登った！
        </Button>
      </div>
    </div>
  );
}
