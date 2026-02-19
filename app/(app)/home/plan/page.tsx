import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlanPageClient } from "@/components/home/PlanPageClient";
import type { ClimbingLog, GymMaster } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const supabase = createClient();
  const [logsRes, gymsRes] = await Promise.all([
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodeURIComponent(userName))
      .eq("type", "実績")
      .gte(
        "date",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      )
      .order("date", { ascending: false }),
    supabase.from("gym_master").select("*").order("gym_name"),
  ]);

  // 直近30日の実績ジム（重複除去・順番保持）
  const recentGymNames: string[] = [];
  for (const log of (logsRes.data || []) as ClimbingLog[]) {
    if (!recentGymNames.includes(log.gym_name)) {
      recentGymNames.push(log.gym_name);
    }
  }

  return (
    <PlanPageClient
      userName={decodeURIComponent(userName)}
      gyms={(gymsRes.data || []) as GymMaster[]}
      recentGymNames={recentGymNames}
    />
  );
}
