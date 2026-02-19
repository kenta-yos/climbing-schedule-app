"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { addClimbingLog } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { getTodayJST } from "@/lib/utils";
import { TIME_SLOTS, MAJOR_AREA_ORDER } from "@/lib/constants";
import type { GymMaster, AreaMaster } from "@/lib/supabase/queries";
import Image from "next/image";
import { X } from "lucide-react";

type Props = {
  userName: string;
  gyms: GymMaster[];
  areas: AreaMaster[];
  onSuccess: () => void;
  onClose: () => void;
  recentGymNames: string[]; // 最近30日以内に訪問したジム
};

export function PlanForm({ userName, gyms, areas, onSuccess, onClose, recentGymNames }: Props) {
  const [date, setDate] = useState(getTodayJST());
  const [timeSlot, setTimeSlot] = useState<string>("夜");
  const [selectedGym, setSelectedGym] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // エリア別にジムを整理
  const gymsByArea = MAJOR_AREA_ORDER.map((majorArea) => {
    const areaTags = areas
      .filter((a) => a.major_area === majorArea)
      .map((a) => a.area_tag);
    const areaGyms = gyms.filter((g) => areaTags.includes(g.area_tag));
    return { majorArea, gyms: areaGyms };
  }).filter((g) => g.gyms.length > 0);

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
      <div className="flex-1 overflow-y-auto space-y-4 pb-2">
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
            🏢 ジム選択
          </label>
          {selectedGym && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="text-sm font-medium text-orange-700 flex-1">{selectedGym}</span>
              <button onClick={() => setSelectedGym("")}>
                <X size={14} className="text-orange-400" />
              </button>
            </div>
          )}
          <Tabs defaultValue={gymsByArea[0]?.majorArea || ""}>
            <TabsList className="mb-2">
              {gymsByArea.map(({ majorArea }) => (
                <TabsTrigger key={majorArea} value={majorArea} className="text-xs px-2">
                  {majorArea}
                </TabsTrigger>
              ))}
            </TabsList>
            {gymsByArea.map(({ majorArea, gyms: areaGyms }) => (
              <TabsContent key={majorArea} value={majorArea}>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {areaGyms.map((gym) => {
                    const isRecent = recentGymNames.includes(gym.gym_name);
                    const isSelected = selectedGym === gym.gym_name;
                    return (
                      <button
                        key={gym.gym_name}
                        onClick={() => setSelectedGym(gym.gym_name)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-150 active:scale-95 ${
                          isSelected
                            ? "border-orange-400 bg-orange-50 text-orange-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {isRecent && <span className="mr-0.5">⭐</span>}
                        {gym.gym_name}
                      </button>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
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
