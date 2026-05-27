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
import { Plus, Trash2, LogOut, CheckCircle2, ChevronDown, ChevronUp, Search, X, Megaphone, Loader2, Pencil } from "lucide-react";
import type { GymMaster, AreaMaster, SetSchedule, Announcement, User } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  setSchedules: SetSchedule[];
  currentUser: string;
  isAdmin?: boolean;
  announcements?: Announcement[];
  users?: User[];
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

export function AdminClient({ gyms, areas, setSchedules, currentUser, isAdmin, announcements: initialAnnouncements = [], users: initialUsers = [] }: Props) {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  // タブ管理（adminは"notice","users"タブも利用可能）
  const [tab, setTab] = useState<"schedule" | "gym" | "notice" | "users">("schedule");
  const [navigatingAnalytics, setNavigatingAnalytics] = useState(false);

  // ---- お知らせ登録 ----
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeUntil, setNoticeUntil] = useState(() => {
    // デフォルト：3日後
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      .replace(/\//g, "-")
      .replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, day) => `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`);
  });
  const [submittingNotice, setSubmittingNotice] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);

  // ---- ユーザー管理 ----
  const [userList, setUserList] = useState<User[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserColor, setNewUserColor] = useState("#f97316");
  const [newUserIcon, setNewUserIcon] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);

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

  // ---- お知らせ登録処理 ----
  const handleAddNotice = async () => {
    if (!noticeContent.trim()) {
      toast({ title: "お知らせ内容を入力してください", variant: "destructive" });
      return;
    }
    if (!noticeUntil) {
      toast({ title: "表示終了日を設定してください", variant: "destructive" });
      return;
    }
    setSubmittingNotice(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noticeContent.trim(), display_until: noticeUntil, created_by: currentUser }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "お知らせを登録しました！", variant: "success" as any });
      setNoticeContent("");
      // 一覧を再取得
      const updated = await fetch("/api/announcements").then((r) => r.json());
      setAnnouncements(updated);
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingNotice(false);
    }
  };

  // ---- お知らせ削除処理 ----
  const handleDeleteNotice = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "削除しました" });
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
    }
  };

  // ---- ユーザー編集処理 ----
  const handleStartEdit = (user: User) => {
    setEditingUser(user.user_name);
    setEditColor(user.color);
    setEditIcon(user.icon);
  };

  const handleSaveUser = async (userName: string) => {
    setSubmittingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: userName, color: editColor, icon: editIcon }),
      });
      if (!res.ok) throw new Error();
      setUserList((prev) =>
        prev.map((u) => u.user_name === userName ? { ...u, color: editColor, icon: editIcon } : u)
      );
      setEditingUser(null);
      toast({ title: "ユーザーを更新しました", variant: "success" as any });
    } catch {
      toast({ title: "更新に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserIcon.trim()) {
      toast({ title: "名前とアイコンを入力してください", variant: "destructive" });
      return;
    }
    setSubmittingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: newUserName.trim(), color: newUserColor, icon: newUserIcon.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch("/api/users").then((r) => r.json());
      setUserList(updated);
      setNewUserName("");
      setNewUserColor("#f97316");
      setNewUserIcon("");
      toast({ title: "ユーザーを追加しました", variant: "success" as any });
    } catch {
      toast({ title: "追加に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userName: string) => {
    try {
      const res = await fetch(`/api/users?user_name=${encodeURIComponent(userName)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUserList((prev) => prev.filter((u) => u.user_name !== userName));
      toast({ title: "ユーザーを削除しました" });
    } catch {
      toast({ title: "削除に失敗しました", variant: "destructive" });
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

        {/* 分析ダッシュボードリンク（アドミンのみ） */}
        {isAdmin && (
          <a
            href="/admin/analytics"
            onClick={() => setNavigatingAnalytics(true)}
            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-800">📊 分析ダッシュボード</span>
            {navigatingAnalytics ? (
              <Loader2 size={16} className="text-gray-400 animate-spin" />
            ) : (
              <span className="text-gray-400 text-xs">→</span>
            )}
          </a>
        )}

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
            🧗 ジム登録
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setTab("notice")}
                className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                  tab === "notice" ? "climbing-gradient text-white" : "text-gray-500"
                }`}
              >
                📣 お知らせ
              </button>
              <button
                onClick={() => setTab("users")}
                className={`flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                  tab === "users" ? "climbing-gradient text-white" : "text-gray-500"
                }`}
              >
                👤 ユーザー
              </button>
            </>
          )}
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
                <span>🧗 登録ジム一覧（{gyms.length}件）</span>
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

        {/* ===== お知らせ登録（adminのみ） ===== */}
        {tab === "notice" && isAdmin && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Megaphone size={16} className="text-orange-500" />
                新機能お知らせ登録
              </h3>

              {/* お知らせ内容 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">内容</label>
                <textarea
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="例：つながりページが公開されました！誰と一緒に登っているかを可視化できます。"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
                />
              </div>

              {/* 表示終了日 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">表示終了日</label>
                <Input
                  type="date"
                  value={noticeUntil}
                  onChange={(e) => setNoticeUntil(e.target.value)}
                  className="text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">この日まで（当日含む）トップページに表示されます</p>
              </div>

              <Button
                onClick={handleAddNotice}
                disabled={submittingNotice}
                variant="climbing"
                className="w-full"
              >
                {submittingNotice ? "登録中..." : "お知らせを登録"}
              </Button>
            </div>

            {/* 登録済みお知らせ一覧 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">📋 登録済みお知らせ</p>
              </div>
              {announcements.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">登録済みのお知らせはありません</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {announcements.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-relaxed">{a.content}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{a.display_until.slice(5).replace("-", "/")} まで表示</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNotice(a.id)}
                        className="flex-shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== ユーザー管理（adminのみ） ===== */}
        {tab === "users" && isAdmin && (
          <>
            {/* 新規登録 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">新規ユーザー登録</h3>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">名前</label>
                  <Input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="名前を入力"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">アイコン</label>
                  <Input
                    value={newUserIcon}
                    onChange={(e) => setNewUserIcon(e.target.value)}
                    placeholder="絵文字"
                    className="text-sm w-16 text-center"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">色</label>
                  <input
                    type="color"
                    value={newUserColor}
                    onChange={(e) => setNewUserColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                  />
                </div>
              </div>
              {/* プレビュー */}
              {(newUserName || newUserIcon) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white"
                    style={{ backgroundColor: newUserColor }}
                  >
                    {newUserIcon || "?"}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{newUserName || "名前未入力"}</span>
                </div>
              )}
              <Button
                onClick={handleAddUser}
                disabled={submittingUser}
                variant="climbing"
                className="w-full"
              >
                {submittingUser ? "登録中..." : "ユーザーを追加"}
              </Button>
            </div>

            {/* ユーザー一覧 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">👤 登録ユーザー（{userList.length}人）</p>
              </div>
              <div className="divide-y divide-gray-50">
                {userList.map((user) => {
                  const isEditing = editingUser === user.user_name;
                  return (
                    <div key={user.user_name} className="px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white flex-shrink-0"
                              style={{ backgroundColor: editColor }}
                            >
                              {editIcon || "?"}
                            </div>
                            <span className="text-sm font-semibold text-gray-800">{user.user_name}</span>
                          </div>
                          <div className="flex items-end gap-3">
                            <div>
                              <label className="text-[11px] text-gray-500 block mb-1">アイコン</label>
                              <Input
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="text-sm w-16 text-center"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-500 block mb-1">色</label>
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                              />
                            </div>
                            <div className="flex gap-2 ml-auto">
                              <button
                                onClick={() => setEditingUser(null)}
                                className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                              >
                                キャンセル
                              </button>
                              <button
                                onClick={() => handleSaveUser(user.user_name)}
                                disabled={submittingUser}
                                className="px-3 py-2 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-60"
                              >
                                {submittingUser ? "保存中…" : "保存"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xl text-white flex-shrink-0"
                            style={{ backgroundColor: user.color }}
                          >
                            {user.icon}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 flex-1">{user.user_name}</span>
                          <button
                            onClick={() => handleStartEdit(user)}
                            className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.user_name)}
                            className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
