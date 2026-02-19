import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlanPageClient } from "@/components/home/PlanPageClient";
import type { ClimbingLog, GymMaster } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { editId?: string };
};

export default async function PlanPage({ searchParams }: Props) {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");
  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();

  // 並列フェッチ：直近実績ログ + ジムマスタ + 編集対象ログ（あれば）
  const [logsRes, gymsRes, editLogRes] = await Promise.all([
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodedUser)
      .eq("type", "実績")
      .gte(
        "date",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      )
      .order("date", { ascending: false }),
    supabase.from("gym_master").select("*").order("gym_name"),
    searchParams.editId
      ? supabase.from("climbing_logs").select("*").eq("id", searchParams.editId).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // 直近30日の実績ジム（重複除去・順番保持）
  const recentGymNames: string[] = [];
  for (const log of (logsRes.data || []) as ClimbingLog[]) {
    if (!recentGymNames.includes(log.gym_name)) {
      recentGymNames.push(log.gym_name);
    }
  }

  // 編集対象ログ：自分のログのみ許可
  const editLog = editLogRes.data as ClimbingLog | null;
  const safeEditLog =
    editLog && editLog.user === decodedUser ? editLog : undefined;

  return (
    <PlanPageClient
      userName={decodedUser}
      gyms={(gymsRes.data || []) as GymMaster[]}
      recentGymNames={recentGymNames}
      editLog={safeEditLog}
    />
  );
}
