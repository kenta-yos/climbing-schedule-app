"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { scoreAllGyms } from "@/lib/scoring";
import { getTodayJST, haversineKm } from "@/lib/utils";
import { MAJOR_AREA_ORDER } from "@/lib/constants";
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

type SortMode = "score" | "distance";
type Origin = { lat: number; lng: number } | null;

// 国土地理院API で住所 → lat/lng
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
  gyms, areas, allLogs, myLogs, friendLogs, setSchedules,
}: Props) {
  // デバッグ：lat/lngの値を確認
  if (typeof window !== "undefined") {
    console.log("[GymsClient] gyms lat/lng:", gyms.map(g => ({ name: g.gym_name, lat: g.lat, lng: g.lng })));
  }

  const [targetDate, setTargetDate] = useState(getTodayJST());
  const [areaFilter, setAreaFilter] = useState<string>("すべて");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [origin, setOrigin] = useState<Origin>(null);
  const [originInput, setOriginInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showLowScore, setShowLowScore] = useState(false);

  // 現在地取得
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGeocodeError("このブラウザは位置情報に対応していません");
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

  // 住所入力でジオコーディング
  const handleGeocode = useCallback(async () => {
    if (!originInput.trim() || originInput === "現在地") return;
    setGeocoding(true);
    setGeocodeError("");
    const result = await geocodeAddress(originInput.trim());
    if (result) {
      setOrigin(result);
    } else {
      setGeocodeError("住所が見つかりませんでした");
      setOrigin(null);
    }
    setGeocoding(false);
  }, [originInput]);

  // 出発地クリア
  const clearOrigin = () => {
    setOrigin(null);
    setOriginInput("");
    setGeocodeError("");
    if (sortMode === "distance") setSortMode("score");
  };

  // エリアフィルタリング
  const filteredGyms = areaFilter === "すべて"
    ? gyms
    : gyms.filter((g) => {
        const area = areas.find((a) => a.area_tag === g.area_tag);
        return area?.major_area === areaFilter;
      });

  // 選択日の仲間ログ
  const friendLogsOnDate = friendLogs.filter(
    (l) => l.date.startsWith(targetDate)
  );

  // 全ジムをスコアリング
  const targetDateObj = new Date(targetDate + "T00:00:00+09:00");
  const allScored = scoreAllGyms({
    gymNames: filteredGyms.map((g) => g.gym_name),
    targetDate: targetDateObj,
    allLogs,
    myLogs,
    setSchedules,
    friendLogs,
  });

  // 距離計算
  const getDistance = (gym: GymMaster): number | null => {
    if (!origin || gym.lat == null || gym.lng == null) return null;
    const d = haversineKm(origin.lat, origin.lng, gym.lat, gym.lng);
    return isFinite(d) ? d : null;
  };

  // gymMapで素早くアクセス
  const gymMap = Object.fromEntries(gyms.map((g) => [g.gym_name, g]));

  // スコアつきジムリストを並び替え
  const sortedScored = [...allScored].sort((a, b) => {
    if (sortMode === "distance") {
      const ga = gymMap[a.gymName];
      const gb = gymMap[b.gymName];
      const da = ga ? getDistance(ga) : null;
      const db = gb ? getDistance(gb) : null;
      // lat/lngがないジムは末尾に
      if (da === null && db === null) return b.score - a.score;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    return b.score - a.score;
  });

  // スコアが正のジム（おすすめ）と低スコアのジム（その他）に分離
  const highScoreGyms = sortedScored.filter((g) => g.score > 0);
  const lowScoreGyms = sortedScored.filter((g) => g.score <= 0);

  return (
    <>
      <PageHeader title="ジム" />
      <div className="px-4 py-4 space-y-4 page-enter">

        {/* エリアフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["すべて", ...MAJOR_AREA_ORDER].map((area) => (
            <button
              key={area}
              onClick={() => setAreaFilter(area)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                areaFilter === area
                  ? "climbing-gradient text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* コントロールバー：日付・ソート */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="flex-1 text-sm h-9"
          />
          {/* ソート切り替え */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            <button
              onClick={() => setSortMode("score")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                sortMode === "score"
                  ? "climbing-gradient text-white"
                  : "bg-white text-gray-500"
              }`}
            >
              おすすめ順
            </button>
            <button
              onClick={() => {
                if (!origin) return; // 出発地未設定は無効
                setSortMode("distance");
              }}
              disabled={!origin}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${
                sortMode === "distance"
                  ? "climbing-gradient text-white"
                  : origin
                  ? "bg-white text-gray-500"
                  : "bg-gray-50 text-gray-300 cursor-not-allowed"
              }`}
            >
              近い順
            </button>
          </div>
        </div>

        {/* 出発地設定 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500">📍 出発地（距離表示用）</p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="住所・駅名を入力（例：渋谷駅）"
              value={originInput}
              onChange={(e) => {
                setOriginInput(e.target.value);
                if (origin) setOrigin(null); // 入力変更したらリセット
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
              {gpsLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <Navigation size={14} />
              }
            </button>
          </div>
          {geocodeError && (
            <p className="text-xs text-red-400">{geocodeError}</p>
          )}
          {origin && (
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-500 font-medium flex-1 truncate">
                {originInput || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
              </span>
              <button onClick={clearOrigin} className="text-xs text-gray-400 hover:text-gray-600">
                クリア
              </button>
            </div>
          )}
        </div>

        {/* ジムカードリスト（スコア高い順） */}
        {filteredGyms.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            該当するジムがありません
          </div>
        ) : (
          <div className="space-y-3">
            {highScoreGyms.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
                このエリアにおすすめジムがありません
              </div>
            )}
            {highScoreGyms.map((scored) => {
              const gym = gymMap[scored.gymName];
              if (!gym) return null;
              return (
                <GymCard
                  key={gym.gym_name}
                  gym={gym}
                  score={scored}
                  myLogs={myLogs}
                  setSchedules={setSchedules}
                  friendLogsOnDate={friendLogsOnDate}
                  distanceKm={getDistance(gym)}
                />
              );
            })}

            {/* 低スコアジムの折りたたみ */}
            {lowScoreGyms.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLowScore((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showLowScore
                    ? <><ChevronUp size={14} />閉じる</>
                    : <><ChevronDown size={14} />他のジム（{lowScoreGyms.length}件）</>
                  }
                </button>
                {showLowScore && (
                  <div className="space-y-3 mt-1">
                    {lowScoreGyms.map((scored) => {
                      const gym = gymMap[scored.gymName];
                      if (!gym) return null;
                      return (
                        <GymCard
                          key={gym.gym_name}
                          gym={gym}
                          score={scored}
                          myLogs={myLogs}
                          setSchedules={setSchedules}
                          friendLogsOnDate={friendLogsOnDate}
                          distanceKm={getDistance(gym)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
