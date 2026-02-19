"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlanForm } from "@/components/home/PlanForm";
import { FuturePlanFeed } from "@/components/home/FuturePlanFeed";
import { MonthlyRanking } from "@/components/home/MonthlyRanking";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getNowJST } from "@/lib/utils";
import type { ClimbingLog, GymMaster, AreaMaster, User } from "@/lib/supabase/queries";

type Props = {
  initialLogs: ClimbingLog[];
  gyms: GymMaster[];
  areas: AreaMaster[];
  users: User[];
  currentUser: string;
};

export function HomeClient({ initialLogs, gyms, areas, users, currentUser }: Props) {
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);
  const [showForm, setShowForm] = useState(false);

  const now = getNowJST();
  const today = now.toISOString().split("T")[0];

  // 自分の直近30日以内に訪問したジム
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const recentGymNames = Array.from(
    new Set(
      logs
        .filter(
          (l) =>
            l.user === currentUser &&
            l.type === "実績" &&
            l.date >= thirtyDaysAgo
        )
        .map((l) => l.gym_name)
    )
  );

  const handleSuccess = useCallback(async () => {
    // 再フェッチ
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <>
      <PageHeader title="Go Bouldering Pro" subtitle={`今日 ${today}`} />

      <div className="px-4 py-4 space-y-6 page-enter">
        {/* フォームモーダル（シンプルなボトムシート） */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <div className="relative bg-white rounded-t-3xl px-4 pt-4 pb-8 max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <PlanForm
                userName={currentUser}
                gyms={gyms}
                areas={areas}
                onSuccess={handleSuccess}
                onClose={() => setShowForm(false)}
                recentGymNames={recentGymNames}
              />
            </div>
          </div>
        )}

        {/* 記録ボタン */}
        <Button
          onClick={() => setShowForm(true)}
          variant="climbing"
          size="xl"
          className="w-full flex items-center gap-2"
        >
          <Plus size={22} />
          クライミングを記録する
        </Button>

        {/* 予定フィード */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>📅</span>
            <span>みんなの予定（3週間）</span>
          </h2>
          <FuturePlanFeed logs={logs} users={users} currentUser={currentUser} />
        </section>

        {/* 月間ランキング */}
        <section>
          <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>🏆</span>
            <span>CLIMB-BAKA AWARD（今月）</span>
          </h2>
          <MonthlyRanking logs={logs} users={users} currentUser={currentUser} />
        </section>
      </div>
    </>
  );
}
