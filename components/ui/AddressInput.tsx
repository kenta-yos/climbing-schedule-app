"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { haversineKm } from "@/lib/utils";

type Candidate = {
  title: string;       // 住所表示名
  lat: number;
  lng: number;
  distanceKm?: number; // 現在地からの距離（GPS取得済み時のみ）
};

type GeoResult = { lat: number; lng: number };

type Props = {
  /** 入力値（controlled） */
  value: string;
  onChange: (value: string) => void;
  /** 確定したときに lat/lng を返す */
  onConfirm: (result: GeoResult, label: string) => void;
  /** 現在の GPS 位置（候補ソート・距離表示用。null でも動作する） */
  gpsOrigin?: GeoResult | null;
  placeholder?: string;
  /** GPS ボタンを表示するか（出発地欄は true、ジム登録は false） */
  showGpsButton?: boolean;
  onGpsClick?: () => void;
  gpsLoading?: boolean;
  /** エラー・成功メッセージ表示 */
  error?: string;
  /** 確定済みかどうか（✅ アイコン表示用） */
  confirmed?: boolean;
};

// 国土地理院 住所検索 API（全候補を取得）
async function fetchCandidates(query: string): Promise<Candidate[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((item: any) => item?.geometry?.coordinates && item?.properties?.title)
      .map((item: any) => {
        const [lng, lat] = item.geometry.coordinates;
        return {
          title: item.properties.title as string,
          lat: lat as number,
          lng: lng as number,
        };
      });
  } catch {
    return [];
  }
}

export function AddressInput({
  value,
  onChange,
  onConfirm,
  gpsOrigin,
  placeholder = "住所・駅名（例：渋谷駅）",
  showGpsButton = false,
  onGpsClick,
  gpsLoading = false,
  error,
  confirmed = false,
}: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // GPS 位置で候補をソートし距離を付与
  const sortByDistance = useCallback(
    (list: Candidate[]): Candidate[] => {
      if (!gpsOrigin) return list;
      return [...list]
        .map((c) => ({
          ...c,
          distanceKm: haversineKm(gpsOrigin.lat, gpsOrigin.lng, c.lat, c.lng),
        }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    },
    [gpsOrigin]
  );

  // 入力変更 → debounce してサジェスト取得
  useEffect(() => {
    if (!value.trim() || value === "現在地") {
      setCandidates([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const list = await fetchCandidates(value);
      const sorted = sortByDistance(list);
      setCandidates(sorted);
      setShowDropdown(sorted.length > 0);
      setLoading(false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, sortByDistance]);

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 候補を選択
  const handleSelect = (c: Candidate) => {
    onChange(c.title);
    onConfirm({ lat: c.lat, lng: c.lng }, c.title);
    setShowDropdown(false);
    setCandidates([]);
  };

  // 「検索」ボタン：サジェスト未選択時は GPS 優先の先頭候補を採用
  const handleSearch = async () => {
    if (!value.trim() || value === "現在地") return;
    // ドロップダウンを即時閉じる（state更新前にローカル変数で現在の候補を保持）
    const currentCandidates = candidates;
    setShowDropdown(false);
    setCandidates([]);

    // すでに候補あり → 先頭を採用
    if (currentCandidates.length > 0) {
      const best = currentCandidates[0];
      onChange(best.title);
      onConfirm({ lat: best.lat, lng: best.lng }, best.title);
      return;
    }
    // まだ候補を取得していない場合はここで取得
    setLoading(true);
    const list = await fetchCandidates(value);
    const sorted = sortByDistance(list);
    setLoading(false);
    if (sorted.length > 0) {
      const best = sorted[0];
      onChange(best.title);
      onConfirm({ lat: best.lat, lng: best.lng }, best.title);
    } else {
      // 親に空を通知（エラー表示は親が担う）
      onConfirm({ lat: NaN, lng: NaN }, "");
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* 入力行 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
              if (e.key === "Escape") setShowDropdown(false);
            }}
            onFocus={() => {
              if (candidates.length > 0) setShowDropdown(true);
            }}
            className="text-sm h-9 pr-7"
          />
          {/* インラインローディング */}
          {loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              <Loader2 size={13} className="animate-spin" />
            </span>
          )}
        </div>

        {/* 検索ボタン */}
        <button
          onClick={handleSearch}
          disabled={loading || !value.trim() || value === "現在地"}
          className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          検索
        </button>

        {/* GPS ボタン（出発地のみ） */}
        {showGpsButton && (
          <button
            onClick={onGpsClick}
            disabled={gpsLoading}
            title="現在地を取得"
            className="px-3 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
          </button>
        )}
      </div>

      {/* サジェストドロップダウン */}
      {showDropdown && candidates.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {candidates.slice(0, 6).map((c, i) => (
            <li key={i}>
              <button
                className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-orange-50 text-left transition-colors border-b border-gray-100 last:border-0"
                onMouseDown={(e) => {
                  // blur より先に選択させるため mousedown で処理
                  e.preventDefault();
                  handleSelect(c);
                }}
              >
                <MapPin size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-800 leading-snug block truncate">
                    {c.title}
                  </span>
                  {c.distanceKm != null && isFinite(c.distanceKm) && (
                    <span className="text-[11px] text-blue-400 font-medium">
                      現在地から{" "}
                      {c.distanceKm < 1
                        ? `${Math.round(c.distanceKm * 1000)}m`
                        : `${c.distanceKm.toFixed(1)}km`}
                    </span>
                  )}
                </div>
                {i === 0 && (
                  <span className="text-[10px] text-orange-400 font-semibold flex-shrink-0 mt-0.5">
                    最近傍
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* エラー */}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {/* 確定済み */}
      {confirmed && !error && (
        <p className="text-xs text-green-600 mt-1">✅ 位置情報を設定しました</p>
      )}
    </div>
  );
}
