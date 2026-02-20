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
import { Plus, Trash2, LogOut, CheckCircle2, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { GymMaster, AreaMaster, SetSchedule } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  setSchedules: SetSchedule[];
  currentUser: string;
};

type DateRange = { start: string; end: string };

// 月ラベル生成（先月・今月・来月）
function getMonthRange() {
  const now = new Date();
  const months = [-1, 0, 1].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return {
      key: `${yyyy}-${mm}`,
      label: offset === -1 ? "先月" : offset === 0 ? "今月" : "来月",
      yyyy,
      mm,
    };
  });
  return months;
}

export function AdminClient({ gyms, areas, setSchedules, currentUser }: Props) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  // タブ管理
  const [tab, setTab] = useState<"schedule" | "gym">("schedule");

  // ---- セットスケジュール登録 ----
  const [selectedGym, setSelectedGym] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { start: getTodayJST(), end: getTodayJST() },
  ]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  // スケジュール一覧アコーディオン
  const [scheduleListOpen, setScheduleListOpen] = useState(false);

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
  // ジム一覧アコーディオン
  const [gymListOpen, setGymListOpen] = useState(false);

  // ジム登録タブを開いたとき GPS 取得（候補ソート用）
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

  // ジム検索フィルター
  const filteredGyms = searchQuery.trim()
    ? gyms.filter((g) =>
        g.gym_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

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
        created_by: currentUser,
      }));
      await addSetSchedules(schedules);
      toast({ title: `${dateRanges.length}件登録しました！`, variant: "success" as any });
      setSelectedGym("");
      setSearchQuery("");
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

  // ---- スケジュール一覧（先月・今月・来月） ----
  const months = getMonthRange();
  const scheduleByMonth = months.map(({ key, label, yyyy, mm }) => {
    const items = setSchedules.filter((s) => {
      const d = s.start_date.slice(0, 7); // "YYYY-MM"
      return d === `${yyyy}-${mm}`;
    });
    return { key, label, items };
  });

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
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">セットスケジュール登録</h3>

              {/* ジム選択（検索式） */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">ジム選択</label>

                {/* 選択済み表示 */}
                {selectedGym ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border border-orange-300 rounded-xl">
                    <span className="text-sm font-semibold text-orange-700 flex-1">✅ {selectedGym}</span>
                    <button
                      onClick={() => { setSelectedGym(""); setSearchQuery(""); }}
                      className="p-0.5 rounded-full hover:bg-orange-100 transition-colors"
                    >
                      <X size={16} className="text-orange-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 検索ボックス */}
                    <div className="relative mb-2">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="ジム名を検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 text-sm"
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
                      <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                        {filteredGyms.length > 0 ? (
                          filteredGyms.map((gym) => (
                            <button
                              key={gym.gym_name}
                              onClick={() => { setSelectedGym(gym.gym_name); setSearchQuery(""); }}
                              className="text-left px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all active:scale-95"
                            >
                              {gym.gym_name}
                            </button>
                          ))
                        ) : (
                          <p className="col-span-2 text-xs text-gray-400 text-center py-4">
                            該当するジムが見つかりません
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">ジム名を入力して検索してください</p>
                    )}
                  </>
                )}
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

            {/* ---- スケジュール一覧（アコーディオン） ---- */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setScheduleListOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
              >
                <span>📋 登録済みスケジュール確認</span>
                {scheduleListOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {scheduleListOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 space-y-4 pt-3">
                  {scheduleByMonth.map(({ key, label, items }) => (
                    <div key={key}>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
                      {items.length === 0 ? (
                        <p className="text-xs text-gray-300 pl-1">データなし</p>
                      ) : (
                        <div className="space-y-1">
                          {items.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                              <span className="font-medium flex-1 truncate">{s.gym_name}</span>
                              <span className="text-gray-400 flex-shrink-0">
                                {s.start_date.slice(5).replace("-", "/")}
                                {s.end_date !== s.start_date && (
                                  <>〜{s.end_date.slice(5).replace("-", "/")}</>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== ジム登録 ===== */}
        {tab === "gym" && (
          <>
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
                  placeholder="https://www.instagram.com/..."
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

            {/* ---- 登録ジム一覧（アコーディオン） ---- */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => setGymListOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
              >
                <span>🏢 登録ジム一覧（{gyms.length}件）</span>
                {gymListOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {gymListOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <div className="space-y-1">
                    {gyms.map((gym) => (
                      <div key={gym.gym_name} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-xs font-medium text-gray-800 flex-1 truncate">{gym.gym_name}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{gym.area_tag}</span>
                        {gym.lat != null && gym.lng != null ? (
                          <span className="text-[11px] text-green-500 flex-shrink-0">📍</span>
                        ) : (
                          <span className="text-[11px] text-gray-300 flex-shrink-0">📍</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
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
