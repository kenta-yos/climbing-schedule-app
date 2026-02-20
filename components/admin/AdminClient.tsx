"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/ui/AddressInput";
import { addGym, addSetSchedules } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { useUserStore } from "@/lib/store/useUserStore";
import { getTodayJST } from "@/lib/utils";
import { Plus, Trash2, LogOut, CheckCircle2 } from "lucide-react";
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

  // タブ管理
  const [tab, setTab] = useState<"schedule" | "gym">("schedule");

  // ---- セットスケジュール登録 ----
  const [selectedGym, setSelectedGym] = useState("");
  const [selectedArea, setSelectedArea] = useState(areas[0]?.major_area ?? "");
  const [postUrl, setPostUrl] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { start: getTodayJST(), end: getTodayJST() },
  ]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // ---- ジム登録 ----
  const [gymName, setGymName] = useState("");
  const [gymUrl, setGymUrl] = useState("");
  const [gymAreaTag, setGymAreaTag] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [geoResult, setGeoResult] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submittingGym, setSubmittingGym] = useState(false);

  // ジム登録画面を開いたとき GPS を取得（候補ソートに使う）
  useEffect(() => {
    if (tab !== "gym") return;
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  }, [tab]);

  // エリア別ジム（セット登録用）
  const majorAreas = Array.from(new Set(areas.map((a) => a.major_area)));
  const gymsInArea = gyms.filter((g) => {
    const area = areas.find((a) => a.area_tag === g.area_tag);
    return area?.major_area === selectedArea;
  });

  // ---- セット登録処理 ----
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
      toast({ title: `${dateRanges.length}件登録しました！`, variant: "success" as any });
      setSelectedGym("");
      setPostUrl("");
      setDateRanges([{ start: getTodayJST(), end: getTodayJST() }]);
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // ---- ジム登録処理 ----
  const handleAddGym = async () => {
    if (!gymName.trim()) {
      toast({ title: "ジム名を入力してください", variant: "destructive" });
      return;
    }
    if (!gymAreaTag) {
      toast({ title: "エリアを選択してください", variant: "destructive" });
      return;
    }
    if (!geoResult) {
      toast({ title: "住所を検索・確定してください", variant: "destructive" });
      return;
    }
    setSubmittingGym(true);
    try {
      await addGym({
        gym_name: gymName.trim(),
        profile_url: gymUrl.trim() || null,
        area_tag: gymAreaTag,
        created_by: currentUser,
        lat: geoResult.lat,
        lng: geoResult.lng,
      });
      toast({ title: "ジムを登録しました！", variant: "success" as any });
      setGymName("");
      setGymUrl("");
      setGymAreaTag("");
      setGymAddress("");
      setGeoResult(null);
      setGeoError("");
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingGym(false);
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

        {/* タブ切り替え */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          <button
            onClick={() => setTab("schedule")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === "schedule" ? "climbing-gradient text-white" : "text-gray-500"
            }`}
          >
            📅 セット登録
          </button>
          <button
            onClick={() => setTab("gym")}
            className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
              tab === "gym" ? "climbing-gradient text-white" : "text-gray-500"
            }`}
          >
            🏢 ジム登録
          </button>
        </div>

        {/* ===== セット登録 ===== */}
        {tab === "schedule" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">セットスケジュール登録</h3>

            {/* エリア選択 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">エリア</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {majorAreas.map((area) => (
                  <button
                    key={area}
                    onClick={() => { setSelectedArea(area); setSelectedGym(""); }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedArea === area
                        ? "climbing-gradient text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {/* ジム選択 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">ジム選択</label>
              {selectedGym && (
                <div className="mb-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
                  <span className="text-sm font-medium text-orange-700">{selectedGym}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                {gymsInArea.map((gym) => (
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
            </div>

            {/* 告知URL */}
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
                        const next = dateRanges.map((r, j) =>
                          j === i ? { ...r, start: e.target.value } : r
                        );
                        setDateRanges(next);
                      }}
                      className="text-sm"
                    />
                    <span className="text-gray-400 text-sm flex-shrink-0">〜</span>
                    <Input
                      type="date"
                      value={range.end}
                      onChange={(e) => {
                        const next = dateRanges.map((r, j) =>
                          j === i ? { ...r, end: e.target.value } : r
                        );
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
                onClick={() =>
                  setDateRanges([...dateRanges, { start: getTodayJST(), end: getTodayJST() }])
                }
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
        )}

        {/* ===== ジム登録 ===== */}
        {tab === "gym" && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">新規ジム登録</h3>

            {/* ジム名 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">ジム名</label>
              <Input
                value={gymName}
                onChange={(e) => setGymName(e.target.value)}
                placeholder="ジム名を入力"
              />
            </div>

            {/* Instagram/URL */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Instagram/URL（任意）</label>
              <Input
                value={gymUrl}
                onChange={(e) => setGymUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>

            {/* エリア */}
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

            {/* 住所（必須） */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                住所・駅名
                <span className="ml-1 text-red-400 font-semibold">*</span>
              </label>
              <AddressInput
                value={gymAddress}
                onChange={(v) => {
                  setGymAddress(v);
                  setGeoResult(null);
                  setGeoError("");
                }}
                onConfirm={(result, label) => {
                  if (!isNaN(result.lat) && !isNaN(result.lng)) {
                    setGeoResult(result);
                    setGeoError("");
                    if (label) setGymAddress(label);
                  } else {
                    setGeoResult(null);
                    setGeoError("住所が見つかりませんでした");
                  }
                }}
                gpsOrigin={gpsOrigin}
                placeholder="例：東京都渋谷区…、渋谷駅"
                error={geoError}
              />
              {geoResult && !geoError && (
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-green-600 font-medium">
                    {geoResult.lat.toFixed(5)}, {geoResult.lng.toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleAddGym}
              disabled={submittingGym || !geoResult}
              variant="climbing"
              className="w-full"
            >
              {submittingGym ? "登録中..." : "ジムを登録"}
            </Button>
          </div>
        )}

        {/* ログアウト */}
        <div className="pt-2">
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
