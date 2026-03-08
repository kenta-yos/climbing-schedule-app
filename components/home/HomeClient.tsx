"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FuturePlanFeed } from "@/components/home/FuturePlanFeed";
import { MonthlyRanking } from "@/components/home/MonthlyRanking";
import { AnnouncementBanner } from "@/components/home/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { SnsIcon } from "@/components/ui/SnsIcon";
import { getTodayJST } from "@/lib/utils";
import type { ClimbingLog, GymMaster, AreaMaster, User, Announcement } from "@/lib/supabase/queries";
import { trackAction } from "@/lib/analytics";

const POLL_INTERVAL = 30_000; // 30秒ごとにバックグラウンド更新
const PTR_THRESHOLD = 72;     // pull-to-refreshのトリガー距離(px)

type NewSetInfo = {
  gym_name: string;
  daysSinceNew: number;
  profile_url: string | null;
};

type Props = {
  initialLogs: ClimbingLog[];
  gyms: GymMaster[];
  areas: AreaMaster[];
  users: User[];
  currentUser: string;
  announcements: Announcement[];
  newSets: NewSetInfo[];
};

export function HomeClient({ initialLogs, users, currentUser, announcements, newSets }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);
  const today = getTodayJST();
  const [navigatingRecord, setNavigatingRecord] = useState(false);
  const [navigatingMore, setNavigatingMore] = useState(false);

  // pull-to-refresh state
  const [pullY, setPullY] = useState(0);         // 引っ張り量(px)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // パスが変わったらnavigatingを解除
  useEffect(() => {
    setNavigatingRecord(false);
    setNavigatingMore(false);
  }, [pathname]);

  // --- データ取得 ---
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/logs?mode=home");
      if (res.ok) setLogs(await res.json());
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

        {/* 新セット情報 */}
        {newSets.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <h3 className="text-xs font-bold text-gray-500 tracking-wide">🔥 最近の新セット</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {newSets.map((s) => {
                const inner = (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-gray-800 truncate">{s.gym_name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-xs font-bold ${s.daysSinceNew <= 7 ? "text-orange-500" : "text-yellow-600"}`}>
                        {s.daysSinceNew}日目
                      </span>
                      {s.profile_url && <SnsIcon url={s.profile_url} size={14} className="text-gray-300" />}
                    </div>
                  </>
                );
                return s.profile_url ? (
                  <a
                    key={s.gym_name}
                    href={s.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={s.gym_name} className="flex items-center justify-between px-4 py-2.5">
                    {inner}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { setNavigatingMore(true); router.push("/gyms?sort=freshset"); }}
              disabled={navigatingMore}
              className="block w-full text-center text-xs text-gray-400 font-medium py-2 hover:text-orange-500 transition-colors border-t border-gray-100"
            >
              {navigatingMore ? "移動中…" : "もっと見る →"}
            </button>
          </div>
        )}

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
