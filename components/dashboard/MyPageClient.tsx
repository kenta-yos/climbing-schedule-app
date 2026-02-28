"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHeader } from "@/components/dashboard/ProfileHeader";
import { UpcomingPlans } from "@/components/dashboard/UpcomingPlans";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { GymVisitHistory } from "@/components/dashboard/GymVisitHistory";
import { MyRecordsAccordion } from "@/components/dashboard/MyRecordsAccordion";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

type Props = {
  initialLogs: ClimbingLog[];
  rankingLogs: ClimbingLog[];
  users: User[];
  currentUser: string;
};

export function MyPageClient({ initialLogs, rankingLogs, users, currentUser }: Props) {
  const [logs, setLogs] = useState<ClimbingLog[]>(initialLogs);

  const handleDeleted = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <>
      <PageHeader title="マイページ" />
      <div className="px-4 py-4 space-y-5 page-enter">
        <ProfileHeader
          currentUser={currentUser}
          users={users}
          rankingLogs={rankingLogs}
        />
        <UpcomingPlans logs={logs} onDeleted={handleDeleted} />
        <MonthlyTrendChart logs={logs} />
        <GymVisitHistory logs={logs} />
        <MyRecordsAccordion
          logs={logs}
          currentUser={currentUser}
          onDeleted={handleDeleted}
        />
      </div>
    </>
  );
}
