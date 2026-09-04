import { GymsClient } from "@/components/gyms/GymsClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { trackAction } from "@/lib/analytics";
import type { ClimbingLog, GymMaster, AreaMaster } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function GymsPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const decodedUser = requireUser();
  const supabase = createClient();

  const [gymsRes, areasRes, myLogsRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("area_tag"),
    // 最終登攀日の算出に使うのは自分の実績だけ
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodedUser)
      .eq("type", "実績")
      .order("date", { ascending: false }),
  ]);

  // ページビュー記録（非同期・fire-and-forget）
  trackAction(decodedUser, "gyms");

  return (
    <GymsClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      myLogs={(myLogsRes.data || []) as ClimbingLog[]}
      currentUser={decodedUser}
      initialSort={searchParams.sort === "overdue" ? "overdue" : undefined}
    />
  );
}
