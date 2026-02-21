import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlanPageClient } from "@/components/home/PlanPageClient";
import { getTodayJST, getDateOffsetJST } from "@/lib/utils";
import type { ClimbingLog, GymMaster, User } from "@/lib/supabase/queries";

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

  const [actualsRes, plansRes, gymsRes, editLogRes, usersRes] = await Promise.all([
    // 直近30日の実績（よく行くジム用）
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodedUser)
      .eq("type", "実績")
      .gte("date", getDateOffsetJST(-30))
      .order("date", { ascending: false }),
    // 自分の予定ログ全件（二重登録チェック用）
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodedUser)
      .eq("type", "予定")
      .gte("date", getTodayJST()),
    supabase.from("gym_master").select("*").order("gym_name"),
    searchParams.editId
      ? supabase.from("climbing_logs").select("*").eq("id", searchParams.editId).single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("users").select("*").order("user_name"),
  ]);

  // 直近30日の実績ジム（重複除去・順番保持）
  const recentGymNames: string[] = [];
  for (const log of (actualsRes.data || []) as ClimbingLog[]) {
    if (!recentGymNames.includes(log.gym_name)) {
      recentGymNames.push(log.gym_name);
    }
  }

  // 編集対象ログ：自分のログのみ許可
  const editLog = editLogRes.data as ClimbingLog | null;
  const safeEditLog =
    editLog && editLog.user === decodedUser ? editLog : undefined;

  // 編集モード かつ 予定ログ の場合、同グループ（同日・同ジム・同時間帯）の他ユーザーのログを取得
  let groupMembers: ClimbingLog[] = [];
  if (safeEditLog && safeEditLog.type === "予定" && safeEditLog.time_slot) {
    const editDate = safeEditLog.date.split("T")[0];
    const groupRes = await supabase
      .from("climbing_logs")
      .select("*")
      .eq("date", editDate)
      .eq("gym_name", safeEditLog.gym_name)
      .eq("time_slot", safeEditLog.time_slot)
      .eq("type", "予定")
      .neq("user", decodedUser);
    groupMembers = (groupRes.data || []) as ClimbingLog[];
  }

  return (
    // key を editId（または "new"）にすることで、編集対象が変わるたびに
    // コンポーネントを完全に再マウントし、フォームの状態をリセットする
    <PlanPageClient
      key={safeEditLog?.id ?? "new"}
      userName={decodedUser}
      gyms={(gymsRes.data || []) as GymMaster[]}
      recentGymNames={recentGymNames}
      myPlans={(plansRes.data || []) as ClimbingLog[]}
      editLog={safeEditLog}
      groupMembers={groupMembers}
      users={(usersRes.data || []) as User[]}
    />
  );
}
