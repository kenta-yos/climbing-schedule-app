import { GymsClient } from "@/components/gyms/GymsClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { trackAction } from "@/lib/analytics";
import type { ClimbingLog, GymMaster, AreaMaster, User } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function GymsPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const decodedUser = requireUser();
  const supabase = createClient();

  const [gymsRes, areasRes, allLogsRes, myLogsRes, usersRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("area_tag"),
    supabase.from("climbing_logs").select("*").order("date", { ascending: false }),
    supabase.from("climbing_logs").select("*").eq("user", decodedUser).order("date", { ascending: false }),
    supabase.from("users").select("*"),
  ]);

  const allLogs = (allLogsRes.data || []) as ClimbingLog[];
  const friendLogs = allLogs.filter((l) => l.user !== decodedUser);

  // ページビュー記録（非同期・fire-and-forget）
  trackAction(decodedUser, "gyms");

  return (
    <GymsClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      allLogs={allLogs}
      myLogs={(myLogsRes.data || []) as ClimbingLog[]}
      friendLogs={friendLogs}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
      initialSort={searchParams.sort === "overdue" ? "overdue" : undefined}
    />
  );
}
