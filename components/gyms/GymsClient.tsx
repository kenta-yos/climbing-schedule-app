"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/ui/AddressInput";
import { getTodayJST, haversineKm } from "@/lib/utils";
import { GymCard } from "@/components/gyms/GymCard";
import type { GymMaster, AreaMaster, ClimbingLog, SetSchedule, User } from "@/lib/supabase/queries";
import { trackAction } from "@/lib/analytics";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  friendLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  users: User[];
  currentUser: string;
  initialSort?: SortTab;
};

type SortTab = "distance" | "freshset" | "overdue";
type Origin = { lat: number; lng: number } | null;

const PAGE_SIZE = 8;

// 東京・神奈川エリアのmajor_area値
const DEFAULT_AREA = "都内・神奈川";

export function GymsClient({
  gyms, areas, myLogs, friendLogs, setSchedules, users, currentUser, initialSort,
}: Props) {
  const [targetDate, setTargetDate] = useState(getTodayJST());
  const [origin, setOrigin] = useState<Origin>(null);
  const [originInput, setOriginInput] = useState("現在地");
  const [geocodeError, setGeocodeError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sortTab, setSortTab] = useState<SortTab>(initialSort ?? "distance");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 無限スクロール用
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((v) => v + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  // 起動時に現在地を自動取得
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        trackAction(currentUser, "gyms", "gps_auto");
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  }, [currentUser]);

  // タブ切り替えで件数リセット
  const handleTabChange = (tab: SortTab) => {
    trackAction(currentUser, "gyms", `sort_${tab}`);
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
        trackAction(currentUser, "gyms", "gps_button");
        setGpsLoading(false);
      },
      () => {
        setGeocodeError("位置情報の取得に失敗しました");
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }, [currentUser]);

  // AddressInput からの確定コールバック
  const handleAddressConfirm = useCallback(
    (result: { lat: number; lng: number }, label: string) => {
      if (!isNaN(result.lat) && !isNaN(result.lng)) {
        setOrigin(result);
        setGeocodeError("");
        if (label) setOriginInput(label);
        trackAction(currentUser, "gyms", "address_set");
      } else {
        setOrigin(null);
        setGeocodeError("住所が見つかりませんでした");
      }
    },
    []
  );

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

  // 最新セット取得（targetDate以前のものに限定。未来のスケジュールは無視）
  const getLatestSchedule = (gymName: string): SetSchedule | null => {
    const schedules = setSchedules
      .filter((s) => s.gym_name === gymName && s.start_date <= targetDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return schedules[0] ?? null;
  };

  // 次のセットスケジュール取得（targetDateより後のもの）
  const getNextSchedule = (gymName: string): SetSchedule | null => {
    const schedules = setSchedules
      .filter((s) => s.gym_name === gymName && s.start_date > targetDate)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
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
    nextSchedule: SetSchedule | null;
    lastVisit: string | null;
    setAge: number | null;      // targetDateからセット完了日まで何日経過
    lastVisitDays: number | null; // targetDateから最終訪問まで何日経過
  };

  const gymsWithMeta: GymWithMeta[] = filteredGyms.map((gym) => {
    const latestSchedule = getLatestSchedule(gym.gym_name);
    const nextSchedule = getNextSchedule(gym.gym_name);
    const lastVisit = getLastVisit(gym.gym_name);
    return {
      gym,
      distanceKm: getDistance(gym),
      latestSchedule,
      nextSchedule,
      lastVisit,
      setAge: latestSchedule ? daysDiffFromTarget(latestSchedule.end_date) : null,
      lastVisitDays: lastVisit ? daysDiffFromTarget(lastVisit.slice(0, 10)) : null,
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

  // 新セット順（セットが新しい順、スケジュールなしは末尾）
  const sortByFreshSet = (): GymWithMeta[] => {
    return [...gymsWithMeta].sort((a, b) => {
      if (a.setAge == null && b.setAge == null) return 0;
      if (a.setAge == null) return 1;
      if (b.setAge == null) return -1;
      return a.setAge - b.setAge;
    });
  };

  // ご無沙汰順（訪問済み優先、未訪問は別枠）
  const sortByOverdue = (): { main: GymWithMeta[]; unvisited: GymWithMeta[] } => {
    const visited = gymsWithMeta.filter((g) => g.lastVisit !== null);
    const unvisited = gymsWithMeta.filter((g) => g.lastVisit === null);
    const sorted = [...visited].sort((a, b) => {
      if (a.lastVisitDays == null && b.lastVisitDays == null) return 0;
      if (a.lastVisitDays == null) return 1;
      if (b.lastVisitDays == null) return -1;
      return b.lastVisitDays - a.lastVisitDays;
    });
    return { main: sorted, unvisited };
  };

  // 表示用データ
  const distanceSorted = sortByDistance();
  const freshSetSorted = sortByFreshSet();
  const { main: overdueMain, unvisited } = sortByOverdue();

  // 現在のタブの主リスト
  const currentMain =
    sortTab === "distance" ? distanceSorted
    : sortTab === "freshset" ? freshSetSorted
    : overdueMain;

  const currentSub =
    sortTab === "overdue" ? unvisited
    : [];

  const subLabel =
    sortTab === "overdue" ? "🆕 未訪問ジム"
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
          <div className="flex items-start gap-3">
            <span className="text-xs font-semibold text-gray-500 w-14 flex-shrink-0 pt-2">📍 出発地</span>
            <div className="flex-1">
              <AddressInput
                value={originInput}
                onChange={(v) => {
                  setOriginInput(v);
                  // テキストを変更したら確定状態をリセット
                  if (v !== "現在地") setOrigin(null);
                }}
                onConfirm={handleAddressConfirm}
                gpsOrigin={origin}
                showGpsButton
                onGpsClick={handleGPS}
                gpsLoading={gpsLoading}
                error={geocodeError}
                confirmed={!!origin && originInput !== "現在地"}
              />
              {originInput === "現在地" && origin && (
                <p className="text-xs text-green-600 mt-1">✅ 現在地を取得しました</p>
              )}
              {gpsLoading && (
                <p className="text-xs text-gray-400 mt-1">現在地を取得中...</p>
              )}
            </div>
          </div>
        </div>

        {/* 全国表示チェックボックス */}
        <label className="flex items-center gap-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => { trackAction(currentUser, "gyms", e.target.checked ? "nationwide_on" : "nationwide_off"); setShowAll(e.target.checked); setVisibleCount(PAGE_SIZE); }}
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
          {visibleMain.map(({ gym, distanceKm, latestSchedule, nextSchedule, lastVisit, setAge, lastVisitDays }) => (
            <GymCard
              key={gym.gym_name}
              gym={gym}
              targetDate={targetDate}
              distanceKm={distanceKm}
              latestSchedule={latestSchedule ?? undefined}
              nextSchedule={nextSchedule ?? undefined}
              lastVisit={lastVisit ?? undefined}
              setAge={setAge ?? undefined}
              lastVisitDays={lastVisitDays ?? undefined}
              friendLogsOnDate={friendLogsOnDate.filter((l) => l.gym_name === gym.gym_name)}
              users={users}
            />
          ))}

          {/* 無限スクロール sentinel */}
          {showMoreMain && <div ref={sentinelRef} className="h-10" />}
        </div>

        {/* サブリスト（スケジュール未登録 / 未訪問） */}
        {currentSub.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium flex-shrink-0">{subLabel}（{currentSub.length}件）</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {currentSub.map(({ gym, distanceKm, latestSchedule, nextSchedule, lastVisit, setAge, lastVisitDays }) => (
              <GymCard
                key={gym.gym_name}
                gym={gym}
                targetDate={targetDate}
                distanceKm={distanceKm}
                latestSchedule={latestSchedule ?? undefined}
                nextSchedule={nextSchedule ?? undefined}
                lastVisit={lastVisit ?? undefined}
                setAge={setAge ?? undefined}
                lastVisitDays={lastVisitDays ?? undefined}
                friendLogsOnDate={friendLogsOnDate.filter((l) => l.gym_name === gym.gym_name)}
                users={users}
                isSub
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
