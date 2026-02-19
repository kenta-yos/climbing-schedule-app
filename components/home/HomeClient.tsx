"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
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

export function HomeClient({ initialLogs, users, currentUser }: Props) {
  const router = useRouter();
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);

  const now = getNowJST();
  const today = now.toISOString().split("T")[0];

  // 参加登録後にフィードを最新化
  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <>
      <PageHeader title="Go Bouldering Pro" subtitle={`今日 ${today}`} />

      <div className="px-4 py-4 space-y-6 page-enter">
        {/* 記録ボタン → /home/plan へ遷移 */}
        <Button
          onClick={() => router.push("/home/plan")}
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
            <span>CLIMB-BAKA AWARD（今月）</span>
          </h2>
          <MonthlyRanking logs={logs} users={users} currentUser={currentUser} />
        </section>
      </div>
    </>
  );
}
