"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { addGym, addSetSchedules, updateGymLocation } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { useUserStore } from "@/lib/store/useUserStore";
import { getTodayJST } from "@/lib/utils";
import { MAJOR_AREA_ORDER } from "@/lib/constants";
import { Plus, Trash2, LogOut, Navigation, Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { GymMaster, AreaMaster } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  currentUser: string;
};

type DateRange = { start: string; end: string };
type LatLng = { lat: number; lng: number } | null;

// 国土地理院API で住所 → lat/lng
async function geocodeAddress(address: string): Promise<LatLng> {
  const res = await fetch(
    `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  const [lng, lat] = data[0].geometry.coordinates;
  return { lat, lng };
}

export function AdminClient({ gyms, areas, currentUser }: Props) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  // ジム登録
  const [gymName, setGymName] = useState("");
  const [gymUrl, setGymUrl] = useState("");
  const [gymAreaTag, setGymAreaTag] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymGeocoding, setGymGeocoding] = useState(false);
  const [gymGeoResult, setGymGeoResult] = useState<LatLng>(null);
  const [gymGeoError, setGymGeoError] = useState("");
  const [submittingGym, setSubmittingGym] = useState(false);

  // セットスケジュール登録
  const [selectedGym, setSelectedGym] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { start: getTodayJST(), end: getTodayJST() },
  ]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // 位置情報タブ
  const [expandedGym, setExpandedGym] = useState<string | null>(null);
  // gymName → { addressInput, geocoding, geoResult, geoError, gpsLoading, saving }
  const [locationStates, setLocationStates] = useState<Record<string, {
    addressInput: string;
    geocoding: boolean;
    geoResult: LatLng;
    geoError: string;
    gpsLoading: boolean;
    saving: boolean;
  }>>({});

  const defaultLocState = {
    addressInput: "",
    geocoding: false,
    geoResult: null as LatLng,
    geoError: "",
    gpsLoading: false,
    saving: false,
  };

  const getLocState = (gName: string) =>
    locationStates[gName] ?? { ...defaultLocState };

  const setLocState = (gName: string, patch: Partial<typeof defaultLocState>) => {
    setLocationStates((prev) => ({
      ...prev,
      [gName]: { ...(prev[gName] ?? { ...defaultLocState }), ...patch },
    }));
  };

  const gymsByArea = MAJOR_AREA_ORDER.map((majorArea) => {
    const areaTags = areas.filter((a) => a.major_area === majorArea).map((a) => a.area_tag);
    const areaGyms = gyms.filter((g) => areaTags.includes(g.area_tag));
    return { majorArea, gyms: areaGyms };
  }).filter((g) => g.gyms.length > 0);

  // ---- ジム登録ジオコーディング ----
  const handleGymGeocode = async () => {
    if (!gymAddress.trim()) return;
    setGymGeocoding(true);
    setGymGeoError("");
    setGymGeoResult(null);
    const result = await geocodeAddress(gymAddress.trim());
    if (result) {
      setGymGeoResult(result);
    } else {
      setGymGeoError("住所が見つかりませんでした");
    }
    setGymGeocoding(false);
  };

  // ---- ジム登録GPS ----
  const handleGymGPS = () => {
    if (!navigator.geolocation) {
      setGymGeoError("このブラウザは位置情報に対応していません");
      return;
    }
    setGymGeocoding(true);
    setGymGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGymGeoResult({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGymAddress("現在地");
        setGymGeocoding(false);
      },
      () => {
        setGymGeoError("位置情報の取得に失敗しました");
        setGymGeocoding(false);
      },
      { timeout: 10000 }
    );
  };

  // ---- ジム登録 ----
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
      await addGym({
        gym_name: gymName.trim(),
        profile_url: gymUrl || null,
        area_tag: gymAreaTag,
        created_by: currentUser,
        lat: gymGeoResult?.lat ?? null,
        lng: gymGeoResult?.lng ?? null,
      });
      toast({ title: "ジムを登録しました！", variant: "success" as any });
      setGymName(""); setGymUrl(""); setGymAreaTag("");
      setGymAddress(""); setGymGeoResult(null); setGymGeoError("");
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingGym(false);
    }
  };

  // ---- セットスケジュール登録 ----
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

  // ---- 位置情報ジオコーディング（既存ジム） ----
  const handleLocGeocode = async (gName: string) => {
    const s = getLocState(gName);
    if (!s.addressInput.trim() || s.addressInput === "現在地") return;
    setLocState(gName, { geocoding: true, geoError: "", geoResult: null });
    const result = await geocodeAddress(s.addressInput.trim());
    if (result) {
      setLocState(gName, { geocoding: false, geoResult: result });
    } else {
      setLocState(gName, { geocoding: false, geoError: "住所が見つかりませんでした" });
    }
  };

  // ---- 位置情報GPS（既存ジム） ----
  const handleLocGPS = (gName: string) => {
    if (!navigator.geolocation) {
      setLocState(gName, { geoError: "このブラウザは位置情報に対応していません" });
      return;
    }
    setLocState(gName, { gpsLoading: true, geoError: "" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocState(gName, {
          gpsLoading: false,
          geoResult: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          addressInput: "現在地",
        });
      },
      () => {
        setLocState(gName, { gpsLoading: false, geoError: "位置情報の取得に失敗しました" });
      },
      { timeout: 10000 }
    );
  };

  // ---- 位置情報保存（既存ジム） ----
  const handleSaveLocation = async (gymName: string) => {
    const s = getLocState(gymName);
    if (!s.geoResult) return;
    setLocState(gymName, { saving: true });
    try {
      await updateGymLocation(gymName, s.geoResult.lat, s.geoResult.lng);
      toast({ title: `${gymName} の位置情報を保存しました`, variant: "success" as any });
      setLocState(gymName, { saving: false, geoError: "" });
    } catch {
      toast({ title: "保存に失敗しました", variant: "destructive" });
      setLocState(gymName, { saving: false });
    }
  };

  // ---- ログアウト ----
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
            <TabsTrigger value="location">📍 位置情報</TabsTrigger>
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

              {/* 住所入力（ジオコーディング） */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">住所・駅名（任意）</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="例：東京都渋谷区…、渋谷駅"
                    value={gymAddress}
                    onChange={(e) => {
                      setGymAddress(e.target.value);
                      if (gymGeoResult) setGymGeoResult(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGymGeocode(); }}
                    className="flex-1 text-sm h-9"
                  />
                  <button
                    onClick={handleGymGeocode}
                    disabled={gymGeocoding || !gymAddress.trim() || gymAddress === "現在地"}
                    className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
                  >
                    {gymGeocoding ? <Loader2 size={14} className="animate-spin" /> : "検索"}
                  </button>
                  <button
                    onClick={handleGymGPS}
                    disabled={gymGeocoding}
                    title="現在地を取得"
                    className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
                  >
                    {gymGeocoding
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Navigation size={14} />
                    }
                  </button>
                </div>
                {gymGeoError && <p className="text-xs text-red-400 mt-1">{gymGeoError}</p>}
                {gymGeoResult && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    <span className="text-xs text-green-600 font-medium">
                      {gymGeoResult.lat.toFixed(5)}, {gymGeoResult.lng.toFixed(5)}
                    </span>
                  </div>
                )}
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

          {/* 位置情報タブ */}
          <TabsContent value="location" className="space-y-3">
            <p className="text-xs text-gray-500 px-1">
              住所・駅名を入力して検索すると、緯度・経度が自動設定されます。
            </p>
            {gyms.map((gym) => {
              const s = getLocState(gym.gym_name);
              const isExpanded = expandedGym === gym.gym_name;
              const hasLocation = gym.lat !== null && gym.lng !== null;

              return (
                <div
                  key={gym.gym_name}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* ジム行（タップで展開） */}
                  <button
                    onClick={() => setExpandedGym(isExpanded ? null : gym.gym_name)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{gym.gym_name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {hasLocation
                          ? `📍 ${gym.lat!.toFixed(4)}, ${gym.lng!.toFixed(4)}`
                          : "位置情報未設定"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasLocation && (
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                      )}
                      {isExpanded
                        ? <ChevronUp size={16} className="text-gray-400" />
                        : <ChevronDown size={16} className="text-gray-400" />
                      }
                    </div>
                  </button>

                  {/* 展開パネル */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="住所・駅名を入力（例：渋谷駅）"
                          value={s.addressInput}
                          onChange={(e) => {
                            setLocState(gym.gym_name, {
                              addressInput: e.target.value,
                              geoResult: null,
                              geoError: "",
                            });
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleLocGeocode(gym.gym_name); }}
                          className="flex-1 text-sm h-9"
                        />
                        <button
                          onClick={() => handleLocGeocode(gym.gym_name)}
                          disabled={s.geocoding || !s.addressInput.trim() || s.addressInput === "現在地"}
                          className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                          {s.geocoding ? <Loader2 size={14} className="animate-spin" /> : "検索"}
                        </button>
                        <button
                          onClick={() => handleLocGPS(gym.gym_name)}
                          disabled={s.gpsLoading}
                          title="現在地を取得"
                          className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                          {s.gpsLoading
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Navigation size={14} />
                          }
                        </button>
                      </div>

                      {s.geoError && (
                        <p className="text-xs text-red-400">{s.geoError}</p>
                      )}

                      {s.geoResult && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                          <span className="text-xs text-green-600 font-medium flex-1">
                            {s.addressInput !== "現在地" ? `${s.addressInput} → ` : "現在地 → "}
                            {s.geoResult.lat.toFixed(5)}, {s.geoResult.lng.toFixed(5)}
                          </span>
                        </div>
                      )}

                      <Button
                        onClick={() => handleSaveLocation(gym.gym_name)}
                        disabled={!s.geoResult || s.saving}
                        variant="climbing"
                        className="w-full h-9 text-sm"
                      >
                        {s.saving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            保存中...
                          </span>
                        ) : "位置情報を保存"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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
