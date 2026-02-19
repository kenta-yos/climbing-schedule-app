"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { addGym, addSetSchedules } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { useUserStore } from "@/lib/store/useUserStore";
import { getTodayJST } from "@/lib/utils";
import { MAJOR_AREA_ORDER } from "@/lib/constants";
import { Plus, Trash2, LogOut } from "lucide-react";
import type { GymMaster, AreaMaster } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  currentUser: string;
};

type DateRange = { start: string; end: string };

export function AdminClient({ gyms, areas, currentUser }: Props) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  // ジム登録
  const [gymName, setGymName] = useState("");
  const [gymUrl, setGymUrl] = useState("");
  const [gymAreaTag, setGymAreaTag] = useState("");
  const [submittingGym, setSubmittingGym] = useState(false);

  // セットスケジュール登録
  const [selectedGym, setSelectedGym] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { start: getTodayJST(), end: getTodayJST() },
  ]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const gymsByArea = MAJOR_AREA_ORDER.map((majorArea) => {
    const areaTags = areas.filter((a) => a.major_area === majorArea).map((a) => a.area_tag);
    const areaGyms = gyms.filter((g) => areaTags.includes(g.area_tag));
    return { majorArea, gyms: areaGyms };
  }).filter((g) => g.gyms.length > 0);

  const handleAddGym = async () => {
    if (!gymName.trim()) {
      toast({ title: "ジム名を入力してください", variant: "destructive" });
      return;
    }
    if (!gymAreaTag) {
      toast({ title: "エリアを選択してください", variant: "destructive" });
      return;
    }
    setSubmittingGym(true);
    try {
      await addGym({ gym_name: gymName.trim(), profile_url: gymUrl || null, area_tag: gymAreaTag, created_by: currentUser });
      toast({ title: "ジムを登録しました！", variant: "success" as any });
      setGymName(""); setGymUrl(""); setGymAreaTag("");
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingGym(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedGym) {
      toast({ title: "ジムを選択してください", variant: "destructive" });
      return;
    }
    setSubmittingSchedule(true);
    try {
      const schedules = dateRanges.map((r) => ({
        gym_name: selectedGym,
        start_date: r.start,
        end_date: r.end,
        post_url: postUrl || null,
        created_by: currentUser,
      }));
      await addSetSchedules(schedules);
      toast({ title: `${dateRanges.length}件のスケジュールを登録しました！`, variant: "success" as any });
      setSelectedGym(""); setPostUrl("");
      setDateRanges([{ start: getTodayJST(), end: getTodayJST() }]);
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleLogout = () => {
    clearUser();
    document.cookie = "user_name=; path=/; max-age=0";
    document.cookie = "user_color=; path=/; max-age=0";
    document.cookie = "user_icon=; path=/; max-age=0";
    router.push("/");
  };

  return (
    <>
      <PageHeader title="管理" />
      <div className="px-4 py-4 space-y-4 page-enter">
        <Tabs defaultValue="schedule">
          <TabsList>
            <TabsTrigger value="schedule">📅 セット登録</TabsTrigger>
            <TabsTrigger value="gym">🏢 ジム登録</TabsTrigger>
          </TabsList>

          {/* セットスケジュール登録 */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">セットスケジュール登録</h3>

              {/* ジム選択 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">ジム選択</label>
                {selectedGym && (
                  <div className="mb-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                    <span className="text-sm font-medium text-orange-700">{selectedGym}</span>
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
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                        {areaGyms.map((gym) => (
                          <button
                            key={gym.gym_name}
                            onClick={() => setSelectedGym(gym.gym_name)}
                            className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                              selectedGym === gym.gym_name
                                ? "border-orange-400 bg-orange-50 text-orange-700"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            {gym.gym_name}
                          </button>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* URL */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">告知URL（任意）</label>
                <Input
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              {/* 日程 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">日程</label>
                <div className="space-y-2">
                  {dateRanges.map((range, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={range.start}
                        onChange={(e) => {
                          const next = [...dateRanges];
                          next[i].start = e.target.value;
                          setDateRanges(next);
                        }}
                        className="text-sm"
                      />
                      <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
                      <Input
                        type="date"
                        value={range.end}
                        onChange={(e) => {
                          const next = [...dateRanges];
                          next[i].end = e.target.value;
                          setDateRanges(next);
                        }}
                        className="text-sm"
                      />
                      {dateRanges.length > 1 && (
                        <button
                          onClick={() => setDateRanges(dateRanges.filter((_, j) => j !== i))}
                          className="p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDateRanges([...dateRanges, { start: getTodayJST(), end: getTodayJST() }])}
                  className="mt-2 flex items-center gap-1 text-xs text-orange-500 font-medium"
                >
                  <Plus size={14} />
                  日程を追加
                </button>
              </div>

              <Button
                onClick={handleAddSchedule}
                disabled={submittingSchedule}
                variant="climbing"
                className="w-full"
              >
                {submittingSchedule ? "登録中..." : "スケジュールを登録"}
              </Button>
            </div>
          </TabsContent>

          {/* ジム登録 */}
          <TabsContent value="gym" className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">新規ジム登録</h3>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">ジム名</label>
                <Input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="ジム名を入力" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Instagram/URL（任意）</label>
                <Input value={gymUrl} onChange={(e) => setGymUrl(e.target.value)} placeholder="https://..." type="url" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">エリア</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {areas.map((area) => (
                    <button
                      key={area.area_tag}
                      onClick={() => setGymAreaTag(area.area_tag)}
                      className={`text-left px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        gymAreaTag === area.area_tag
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {area.area_tag}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAddGym}
                disabled={submittingGym}
                variant="climbing"
                className="w-full"
              >
                {submittingGym ? "登録中..." : "ジムを登録"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* ログアウト */}
        <div className="pt-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full flex items-center gap-2 text-gray-500 border-gray-200"
          >
            <LogOut size={16} />
            ログアウト
          </Button>
        </div>
      </div>
    </>
  );
}
