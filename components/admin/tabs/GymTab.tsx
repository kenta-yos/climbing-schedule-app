"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/ui/AddressInput";
import { addGym } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { CheckCircle2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { GymMaster, AreaMaster } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  currentUser: string;
};

export function GymTab({ gyms, areas, currentUser }: Props) {
  // ---- ジム編集 ----
  const [editingGym, setEditingGym] = useState<string | null>(null);
  const [editGymUrl, setEditGymUrl] = useState("");
  const [editGymAreaTag, setEditGymAreaTag] = useState("");
  const [savingGym, setSavingGym] = useState(false);
  const [gymList, setGymList] = useState<GymMaster[]>(gyms);

  const handleStartEditGym = (gym: GymMaster) => {
    setEditingGym(gym.gym_name);
    setEditGymUrl(gym.profile_url || "");
    setEditGymAreaTag(gym.area_tag);
  };

  const handleSaveGym = async (gymName: string) => {
    setSavingGym(true);
    try {
      const res = await fetch("/api/gyms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym_name: gymName, profile_url: editGymUrl, area_tag: editGymAreaTag }),
      });
      if (res.ok) {
        setGymList((prev) =>
          prev.map((g) => g.gym_name === gymName ? { ...g, profile_url: editGymUrl || null, area_tag: editGymAreaTag } : g)
        );
        setEditingGym(null);
        toast({ title: "ジムを更新しました", variant: "success" });
      }
    } catch {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    } finally {
      setSavingGym(false);
    }
  };

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

  // マウント時に GPS 取得（住所候補のソート用）。
  // このコンポーネントはジム登録タブが選ばれたときだけ描画される。
  useEffect(() => {
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
  }, []);

  // ---- ジム登録処理 ----
  const handleAddGym = async () => {
    if (!gymName.trim()) {
      toast({ title: "ジム名を入力してください", variant: "destructive" });
      return;
    }
    const url = gymUrl.trim();
    if (!url) {
      toast({ title: "Instagram か公式サイトの URL を入力してください", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      toast({ title: "URL は https:// から始まる形式で入力してください", variant: "destructive" });
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
        profile_url: url,
        area_tag: gymAreaTag,
        created_by: currentUser,
        lat: geoResult.lat,
        lng: geoResult.lng,
      });
      toast({ title: "ジムを登録しました！", variant: "success" });
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

  return (
    <>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">新規ジム登録</h3>

          {/* ジム名 */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              ジム名
              <span className="ml-1 text-red-400 font-semibold">*</span>
            </label>
            <Input
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="ジム名を入力"
            />
          </div>

          {/* Instagram / 公式サイト（必須） */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Instagram
              <span className="ml-1 text-red-400 font-semibold">*</span>
            </label>
            <Input
              value={gymUrl}
              onChange={(e) => setGymUrl(e.target.value)}
              placeholder="https://www.instagram.com/..."
              type="url"
              inputMode="url"
              autoComplete="off"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Instagram が無いジムは X や Facebook、公式サイトの URL でも構いません
            </p>
          </div>

          {/* エリア */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              エリア
              <span className="ml-1 text-red-400 font-semibold">*</span>
            </label>
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
            <span>🧗 登録ジム一覧（{gymList.length}件）</span>
            {gymListOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {gymListOpen && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3">
              <div className="space-y-1">
                {gymList.map((gym) => {
                  const isEditing = editingGym === gym.gym_name;
                  return (
                    <div key={gym.gym_name} className="py-1.5 border-b border-gray-50 last:border-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-800">{gym.gym_name}</p>
                          <div>
                            <label className="text-[10px] text-gray-500">URL</label>
                            <Input
                              value={editGymUrl}
                              onChange={(e) => setEditGymUrl(e.target.value)}
                              placeholder="https://..."
                              className="text-xs h-8"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500">エリア</label>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {areas.map((area) => (
                                <button
                                  key={area.area_tag}
                                  onClick={() => setEditGymAreaTag(area.area_tag)}
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                                    editGymAreaTag === area.area_tag
                                      ? "border-orange-400 bg-orange-50 text-orange-700"
                                      : "border-gray-200 text-gray-600"
                                  }`}
                                >
                                  {area.area_tag}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingGym(null)} className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">キャンセル</button>
                            <button onClick={() => handleSaveGym(gym.gym_name)} disabled={savingGym} className="flex-1 py-1.5 text-xs text-white bg-orange-500 rounded-lg disabled:opacity-60">{savingGym ? "保存中…" : "保存"}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-800 flex-1 truncate">{gym.gym_name}</span>
                          <span className="text-[11px] text-gray-400 flex-shrink-0">{gym.area_tag}</span>
                          {gym.lat != null && gym.lng != null ? (
                            <span className="text-[11px] text-green-500 flex-shrink-0">📍</span>
                          ) : (
                            <span className="text-[11px] text-gray-300 flex-shrink-0">📍</span>
                          )}
                          <button onClick={() => handleStartEditGym(gym)} className="p-1 text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0">
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </>
  );
}
