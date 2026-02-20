"use client";

import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Navigation, Loader2 } from "lucide-react";
import { getTodayJST, haversineKm } from "@/lib/utils";
import { GymCard } from "@/components/gyms/GymCard";
import type { GymMaster, AreaMaster, ClimbingLog, SetSchedule, User } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  friendLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  users: User[];
  currentUser: string;
};

type SortTab = "distance" | "freshset" | "overdue";
type Origin = { lat: number; lng: number } | null;

const PAGE_SIZE = 8;

// 東京・神奈川エリアのmajor_area値
const DEFAULT_AREA = "都内・神奈川";

async function geocodeAddress(address: string): Promise<Origin> {
  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const [lng, lat] = data[0].geometry.coordinates;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export function GymsClient({
  gyms, areas, myLogs, friendLogs, setSchedules,
}: Props) {
  const [targetDate, setTargetDate] = useState(getTodayJST());
  const [origin, setOrigin] = useState<Origin>(null);
  const [originInput, setOriginInput] = useState("現在地");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sortTab, setSortTab] = useState<SortTab>("distance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 起動時に現在地を自動取得
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  }, []);

  // タブ切り替えで件数リセット
  const handleTabChange = (tab: SortTab) => {
    setSortTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  // GPS取得
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGeocodeError("位置情報に対応していません");
      return;
    }
    setGpsLoading(true);
    setGeocodeError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginInput("現在地");
        setGpsLoading(false);
      },
      () => {
        setGeocodeError("位置情報の取得に失敗しました");
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  // 住所ジオコーディング
  const handleGeocode = useCallback(async () => {
    if (!originInput.trim() || originInput === "現在地") return;
    setGeocoding(true);
    setGeocodeError("");
    const result = await geocodeAddress(originInput.trim());
    setGeocoding(false);
    if (result) {
      setOrigin(result);
    } else {
      setGeocodeError("住所が見つかりませんでした");
      setOrigin(null);
    }
  }, [originInput]);

  // エリアフィルター
  const filteredGyms = showAll
    ? gyms
    : gyms.filter((g) => {
        const area = areas.find((a) => a.area_tag === g.area_tag);
        return area?.major_area === DEFAULT_AREA;
      });

  // 選択日の仲間ログ
  const friendLogsOnDate = friendLogs.filter((l) => l.date.startsWith(targetDate));

  // 距離計算
  const getDistance = (gym: GymMaster): number | null => {
    if (!origin || gym.lat == null || gym.lng == null) return null;
    const d = haversineKm(origin.lat, origin.lng, gym.lat, gym.lng);
    return isFinite(d) ? d : null;
  };

  // 最新セット取得
  const getLatestSchedule = (gymName: string): SetSchedule | null => {
    const schedules = setSchedules
      .filter((s) => s.gym_name === gymName)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return schedules[0] ?? null;
  };

  // 最終訪問日取得（自分）
  const getLastVisit = (gymName: string): string | null => {
    const visits = myLogs
      .filter((l) => l.gym_name === gymName && l.type === "実績")
      .sort((a, b) => b.date.localeCompare(a.date));
    return visits[0]?.date ?? null;
  };

  // 日数差（targetDate基準）
  const daysDiffFromTarget = (dateStr: string): number => {
    const target = new Date(targetDate + "T00:00:00+09:00");
    const d = new Date(dateStr + "T00:00:00+09:00");
    return Math.floor((target.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ---- ソート ----
  type GymWithMeta = {
    gym: GymMaster;
    distanceKm: number | null;
    latestSchedule: SetSchedule | null;
    lastVisit: string | null;
    setAge: number | null;      // targetDateからセット開始日まで何日経過
    lastVisitDays: number | null; // targetDateから最終訪問まで何日経過
  };

  const gymsWithMeta: GymWithMeta[] = filteredGyms.map((gym) => {
    const latestSchedule = getLatestSchedule(gym.gym_name);
    const lastVisit = getLastVisit(gym.gym_name);
    return {
      gym,
      distanceKm: getDistance(gym),
      latestSchedule,
      lastVisit,
      setAge: latestSchedule ? daysDiffFromTarget(latestSchedule.start_date) : null,
      lastVisitDays: lastVisit ? daysDiffFromTarget(lastVisit) : null,
    };
  });

  // 近い順
  const sortByDistance = (): GymWithMeta[] => {
    return [...gymsWithMeta].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  };

  // 新セット順（セットあり優先、セットなしは別枠）
  const sortByFreshSet = (): { main: GymWithMeta[]; noSchedule: GymWithMeta[] } => {
    const withSchedule = gymsWithMeta.filter((g) => g.latestSchedule !== null);
    const noSchedule = gymsWithMeta.filter((g) => g.latestSchedule === null);
    const sorted = [...withSchedule].sort((a, b) => {
      // setAge が小さい（最近セット替え）順
      if (a.setAge == null && b.setAge == null) return 0;
      if (a.setAge == null) return 1;
      if (b.setAge == null) return -1;
      return a.setAge - b.setAge;
    });
    return { main: sorted, noSchedule };
  };

  // ご無沙汰順（訪問済み優先、未訪問は別枠）
  const sortByOverdue = (): { main: GymWithMeta[]; unvisited: GymWithMeta[] } => {
    const visited = gymsWithMeta.filter((g) => g.lastVisit !== null);
    const unvisited = gymsWithMeta.filter((g) => g.lastVisit === null);
    const sorted = [...visited].sort((a, b) => {
      // lastVisitDays が大きい（長く行ってない）順
      if (a.lastVisitDays == null && b.lastVisitDays == null) return 0;
      if (a.lastVisitDays == null) return 1;
      if (b.lastVisitDays == null) return -1;
      return b.lastVisitDays - a.lastVisitDays;
    });
    return { main: sorted, unvisited };
  };

  // 表示用データ
  const distanceSorted = sortByDistance();
  const { main: freshSetMain, noSchedule } = sortByFreshSet();
  const { main: overdueMain, unvisited } = sortByOverdue();

  // 現在のタブの主リスト
  const currentMain =
    sortTab === "distance" ? distanceSorted
    : sortTab === "freshset" ? freshSetMain
    : overdueMain;

  const currentSub =
    sortTab === "freshset" ? noSchedule
    : sortTab === "overdue" ? unvisited
    : [];

  const subLabel =
    sortTab === "freshset" ? "📋 スケジュール未登録"
    : sortTab === "overdue" ? "🆕 未訪問ジム"
    : "";

  const totalMain = currentMain.length;
  const showMoreMain = visibleCount < totalMain;
  const visibleMain = currentMain.slice(0, visibleCount);

  return (
    <>
      <PageHeader title="ジム" />
      <div className="px-4 py-4 space-y-3 page-enter">

        {/* 登る日・出発地 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">
          {/* 登る日 */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 w-14 flex-shrink-0">📅 登る日</span>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => { setTargetDate(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="flex-1 text-sm h-9"
            />
          </div>

          {/* 出発地 */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 w-14 flex-shrink-0">📍 出発地</span>
            <div className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder="住所・駅名（例：渋谷駅）"
                value={originInput}
                onChange={(e) => {
                  setOriginInput(e.target.value);
                  setOrigin(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleGeocode(); }}
                className="flex-1 text-sm h-9"
              />
              <button
                onClick={handleGeocode}
                disabled={geocoding || !originInput.trim() || originInput === "現在地"}
                className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {geocoding ? <Loader2 size={14} className="animate-spin" /> : "検索"}
              </button>
              <button
                onClick={handleGPS}
                disabled={gpsLoading}
                title="現在地を取得"
                className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              </button>
            </div>
          </div>
          {geocodeError && <p className="text-xs text-red-400 pl-[68px]">{geocodeError}</p>}
          {origin && originInput !== "現在地" && (
            <p className="text-xs text-green-600 pl-[68px]">
              ✅ 位置情報を設定しました
            </p>
          )}
          {gpsLoading && (
            <p className="text-xs text-gray-400 pl-[68px]">現在地を取得中...</p>
          )}
        </div>

        {/* 全国表示チェックボックス */}
        <label className="flex items-center gap-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => { setShowAll(e.target.checked); setVisibleCount(PAGE_SIZE); }}
            className="w-4 h-4 accent-orange-500"
          />
          <span className="text-sm text-gray-600">全国のジムを表示する</span>
          {!showAll && (
            <span className="text-xs text-gray-400">（現在：東京・神奈川）</span>
          )}
        </label>

        {/* ソートタブ */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(["distance", "freshset", "overdue"] as SortTab[]).map((tab) => {
            const label =
              tab === "distance" ? "📍 近い順"
              : tab === "freshset" ? "🔥 新セット順"
              : "⌛ ご無沙汰順";
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 py-2 text-xs font-medium transition-colors border-l first:border-l-0 border-gray-200 ${
                  sortTab === tab ? "climbing-gradient text-white" : "text-gray-500"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 近い順で出発地未設定の場合の注意 */}
        {sortTab === "distance" && !origin && (
          <p className="text-xs text-gray-400 text-center">
            出発地を設定すると距離順に並び替えます
          </p>
        )}

        {/* ジムカードリスト（メイン） */}
        <div className="space-y-3">
          {visibleMain.map(({ gym, distanceKm, latestSchedule, lastVisit, setAge, lastVisitDays }) => (
            <GymCard
              key={gym.gym_name}
              gym={gym}
              targetDate={targetDate}
              distanceKm={distanceKm}
              latestSchedule={latestSchedule ?? undefined}
              lastVisit={lastVisit ?? undefined}
              setAge={setAge ?? undefined}
              lastVisitDays={lastVisitDays ?? undefined}
              friendLogsOnDate={friendLogsOnDate.filter((l) => l.gym_name === gym.gym_name)}
            />
          ))}

          {/* もっと見る */}
          {showMoreMain && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full py-3 text-sm text-orange-500 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-orange-50 transition-colors"
            >
              もっと見る（残り {totalMain - visibleCount} 件）
            </button>
          )}
        </div>

        {/* サブリスト（スケジュール未登録 / 未訪問） */}
        {currentSub.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium flex-shrink-0">{subLabel}（{currentSub.length}件）</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {currentSub.map(({ gym, distanceKm, latestSchedule, lastVisit, setAge, lastVisitDays }) => (
              <GymCard
                key={gym.gym_name}
                gym={gym}
                targetDate={targetDate}
                distanceKm={distanceKm}
                latestSchedule={latestSchedule ?? undefined}
                lastVisit={lastVisit ?? undefined}
                setAge={setAge ?? undefined}
                lastVisitDays={lastVisitDays ?? undefined}
                friendLogsOnDate={friendLogsOnDate.filter((l) => l.gym_name === gym.gym_name)}
                isSub
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
