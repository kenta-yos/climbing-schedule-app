"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FuturePlanFeed } from "@/components/home/FuturePlanFeed";
import { MonthlyRanking } from "@/components/home/MonthlyRanking";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { getTodayJST } from "@/lib/utils";
import { GYM_UNDECIDED_LABEL } from "@/components/home/PlanPageClient";
import type { ClimbingLog, User, Announcement, WorkShift } from "@/lib/supabase/queries";
import { toast } from "@/lib/hooks/use-toast";
import { trackAction } from "@/lib/analytics";

const POLL_INTERVAL = 30_000;
const PTR_THRESHOLD = 72;
const SHIFT_GYM = "THE STONE SESSION TOKYO";
const SHIFT_USER = "Dai";

type Props = {
  initialLogs: ClimbingLog[];
  users: User[];
  currentUser: string;
  announcements: Announcement[];
  initialShifts?: WorkShift[];
};

export function HomeClient({ initialLogs, users, currentUser, announcements, initialShifts = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);
  const [shifts, setShifts] = useState<WorkShift[]>(initialShifts);
  const today = getTodayJST();
  const [navigatingRecord, setNavigatingRecord] = useState(false);

  // シフト登録（Daiのみ）
  const [shiftDate, setShiftDate] = useState(getTodayJST());
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [submittingShift, setSubmittingShift] = useState(false);
  const [shiftFormOpen, setShiftFormOpen] = useState(false);

  const handleAddShift = useCallback(async () => {
    if (!shiftDate || !shiftStart || !shiftEnd) return;
    setSubmittingShift(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: SHIFT_USER, gym_name: SHIFT_GYM, date: shiftDate, start_time: shiftStart, end_time: shiftEnd }),
      });
      if (res.ok) {
        const updated = await fetch("/api/shifts").then((r) => r.json());
        setShifts(updated);
        setShiftFormOpen(false);
        toast({ title: "🍺 シフトを登録しました！", variant: "success" as any });
      } else {
        toast({ title: "登録に失敗しました", variant: "destructive" });
      }
    } catch {
      toast({ title: "登録に失敗しました", variant: "destructive" });
    } finally {
      setSubmittingShift(false);
    }
  }, [shiftDate, shiftStart, shiftEnd]);

  // pull-to-refresh state
  const [pullY, setPullY] = useState(0);         // 引っ張り量(px)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // パスが変わったらnavigatingを解除
  useEffect(() => {
    setNavigatingRecord(false);
  }, [pathname]);

  // --- データ取得 ---
  const fetchLogs = useCallback(async () => {
    try {
      const [logsRes, shiftsRes] = await Promise.all([
        fetch("/api/logs?mode=home"),
        fetch("/api/shifts"),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 手動リフレッシュ（pull-to-refresh・参加登録後）
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  }, [fetchLogs]);

  // --- マウント時の即時取得（編集画面から戻ってきた際などに最新データを確実に表示） ---
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // --- バックグラウンドポーリング ---
  useEffect(() => {
    const id = setInterval(() => {
      // ページが非表示なら更新しない
      if (document.visibilityState === "hidden") return;
      fetchLogs();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchLogs]);

  // --- タブに戻ってきたとき (visibilitychange) ---
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchLogs();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchLogs]);

  // --- Pull-to-Refresh タッチハンドラ ---
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // スクロール位置が最上部のときだけ開始
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      // ゴム感を出すためにdyに減衰をかける
      setPullY(Math.min(dy * 0.45, PTR_THRESHOLD + 20));
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;
    if (pullY >= PTR_THRESHOLD) {
      setPullY(0);
      await handleRefresh();
    } else {
      setPullY(0);
    }
  }, [pullY, handleRefresh]);

  const isPulledEnough = pullY >= PTR_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh インジケーター */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: isRefreshing ? 52 : pullY > 0 ? pullY : 0 }}
      >
        <div className={`flex flex-col items-center gap-1 transition-opacity duration-150 ${(pullY > 10 || isRefreshing) ? "opacity-100" : "opacity-0"}`}>
          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${isPulledEnough || isRefreshing ? "border-orange-400" : "border-gray-300"}`}>
            {isRefreshing ? (
              <Loader2 size={14} className="animate-spin text-orange-400" />
            ) : (
              <span
                className="text-base transition-transform duration-150"
                style={{ transform: isPulledEnough ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                ↓
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400">
            {isRefreshing ? "更新中…" : isPulledEnough ? "離して更新" : "引っ張って更新"}
          </span>
        </div>
      </div>

      <PageHeader title="Go Bouldering" subtitle={`今日 ${today}`} icon="/icon-192.png" />

      <AnnouncementBanner announcements={announcements} />

      <div className="px-4 py-4 space-y-6 page-enter">
        {/* 記録ボタン → /home/plan へ遷移 */}
        <Button
          onClick={() => { trackAction(currentUser, "home", "record_tapped"); setNavigatingRecord(true); router.push("/home/plan"); }}
          disabled={navigatingRecord}
          variant="climbing"
          size="xl"
          className="w-full flex items-center gap-2"
        >
          {navigatingRecord ? (
            <><Loader2 size={20} className="animate-spin" />移動中…</>
          ) : (
            <><Plus size={22} />クライミングを記録する</>
          )}
        </Button>

        {/* Daiのシフト登録（Daiのみ） */}
        {currentUser === SHIFT_USER && (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 overflow-hidden">
            <button
              onClick={() => setShiftFormOpen((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between"
            >
              <span className="text-sm font-semibold text-emerald-700">🍺 バイトシフトを登録</span>
              <span className="text-emerald-400 text-xs">{shiftFormOpen ? "▲" : "▼"}</span>
            </button>
            {shiftFormOpen && (
              <div className="px-4 pb-3 space-y-2 border-t border-emerald-100">
                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-emerald-600 block mb-0.5">日付</label>
                    <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="text-sm h-9" />
                  </div>
                  <div className="w-20">
                    <label className="text-[11px] text-emerald-600 block mb-0.5">開始</label>
                    <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="text-sm h-9" />
                  </div>
                  <div className="w-20">
                    <label className="text-[11px] text-emerald-600 block mb-0.5">終了</label>
                    <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="text-sm h-9" />
                  </div>
                </div>
                <Button onClick={handleAddShift} disabled={submittingShift} variant="climbing" className="w-full h-9 text-sm">
                  {submittingShift ? "登録中…" : "シフトを登録"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 人気ジム TOP3 */}
        {(() => {
          const gymCount: Record<string, number> = {};
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          logs
            .filter((l) => l.type === "実績" && l.gym_name !== GYM_UNDECIDED_LABEL && l.date >= thirtyDaysAgo)
            .forEach((l) => { gymCount[l.gym_name] = (gymCount[l.gym_name] || 0) + 1; });
          const top3 = Object.entries(gymCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          if (top3.length === 0) return null;
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-bold text-gray-500 flex-shrink-0">🔥 人気</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {top3.map(([gym, count], i) => (
                  <span key={gym} className="text-xs text-gray-700">
                    <span>{medals[i]}</span>
                    <span className="font-semibold">{gym}</span>
                    <span className="text-gray-400 ml-0.5">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 予定フィード */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>📅</span>
            <span>みんなの予定</span>
          </h2>
          <FuturePlanFeed
            logs={logs}
            users={users}
            currentUser={currentUser}
            onJoined={handleRefresh}
            shifts={shifts}
          />
        </section>

        {/* 月間ランキング */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>🏆</span>
            <span>CLIMB-BAKA AWARD</span>
          </h2>
          <MonthlyRanking logs={logs} users={users} currentUser={currentUser} />
        </section>
      </div>
    </div>
  );
}
