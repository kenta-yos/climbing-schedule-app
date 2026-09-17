"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHeader } from "@/components/dashboard/ProfileHeader";
import { UpcomingPlans } from "@/components/dashboard/UpcomingPlans";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { GymVisitHistory } from "@/components/dashboard/GymVisitHistory";
import { MyRecordsAccordion } from "@/components/dashboard/MyRecordsAccordion";
import type { ClimbingLog, User, GymMaster } from "@/lib/supabase/queries";

type Props = {
  initialLogs: ClimbingLog[];
  rankingLogs: ClimbingLog[];
  users: User[];
  gyms: GymMaster[];
  currentUser: string;
};

export function MyPageClient({ initialLogs, rankingLogs, users, gyms, currentUser }: Props) {
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);

  // user を付けないと全員分のログが返り、ジム訪問履歴や月別推移が他人の記録まで
  // 数え始める。削除の直後だけ数字が跳ねる形になるので取り違えやすい
  const handleDeleted = useCallback(async () => {
    try {
      const res = await fetch(`/api/logs?user=${encodeURIComponent(currentUser)}`);
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  return (
    <>
      <PageHeader title="マイページ" />
      <div className="px-4 py-4 space-y-5 page-enter">
        <ProfileHeader
          currentUser={currentUser}
          users={users}
          rankingLogs={rankingLogs}
        />
        <UpcomingPlans logs={logs} currentUser={currentUser} onDeleted={handleDeleted} />
        <MonthlyTrendChart logs={logs} />
        <GymVisitHistory logs={logs} gyms={gyms} />
        <MyRecordsAccordion
          logs={logs}
          currentUser={currentUser}
          onDeleted={handleDeleted}
        />
      </div>
    </>
  );
}
