import { MyPageClient } from "@/components/dashboard/MyPageClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getNowJST, toJSTDateString } from "@/lib/utils";
import { trackAction } from "@/lib/analytics";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { ClimbingLog, User, GymMaster } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const decodedUser = requireUser();

  const supabase = createClient();

  // 先月1日を算出（ランキング用の範囲起点）
  const now = getNowJST();
  const lastMonthStr = toJSTDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  // 並列でデータ取得
  const [myLogs, rankingLogs, usersRes, gymsRes] = await Promise.all([
    // 自分の全ログ（予定+実績）。ジム訪問履歴は全期間を数えるので取り切る
    fetchAllRows<ClimbingLog>((from, to) =>
      supabase
        .from("climbing_logs")
        .select("*")
        .eq("user", decodedUser)
        .order("date", { ascending: false })
        .range(from, to)
    ),
    // ランキング用: 全ユーザーの実績（先月1日以降）
    fetchAllRows<ClimbingLog>((from, to) =>
      supabase
        .from("climbing_logs")
        .select("*")
        .eq("type", "実績")
        .gte("date", lastMonthStr)
        .order("date", { ascending: false })
        .range(from, to)
    ),
    // ユーザー一覧
    supabase.from("users").select("*").order("user_name"),
    // ジムマスター
    supabase.from("gym_master").select("*").order("gym_name"),
  ]);

  // ページビュー記録（非同期・fire-and-forget）
  trackAction(decodedUser, "dashboard");

  return (
    <MyPageClient
      initialLogs={myLogs}
      rankingLogs={rankingLogs}
      users={(usersRes.data || []) as User[]}
      gyms={(gymsRes.data || []) as GymMaster[]}
      currentUser={decodedUser}
    />
  );
}
