"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { FuturePlanFeed } from "@/components/home/FuturePlanFeed";
import { MonthlyRanking } from "@/components/home/MonthlyRanking";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { getTodayJST } from "@/lib/utils";
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

  const pathname = usePathname();
  const today = getTodayJST();
  const [navigating, setNavigating] = useState(false);

  // パスが変わったらローディング解除（念のため）
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

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
          onClick={() => { setNavigating(true); router.push("/home/plan"); }}
          disabled={navigating}
          variant="climbing"
          size="xl"
          className="w-full flex items-center gap-2"
        >
          {navigating ? (
            <><Loader2 size={20} className="animate-spin" />移動中…</>
          ) : (
            <><Plus size={22} />クライミングを記録する</>
          )}
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
