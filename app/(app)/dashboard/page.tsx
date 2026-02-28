import { MyPageClient } from "@/components/dashboard/MyPageClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getNowJST } from "@/lib/utils";
import type { ClimbingLog, User } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();

  // 先月1日を算出（ランキング用の範囲起点）
  const now = getNowJST();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;

  // 並列でデータ取得
  const [myLogsRes, rankingLogsRes, usersRes] = await Promise.all([
    // 自分の全ログ（予定+実績）
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("user", decodedUser)
      .order("date", { ascending: false }),
    // ランキング用: 全ユーザーの実績（先月1日以降）
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("type", "実績")
      .gte("date", lastMonthStr)
      .order("date", { ascending: false }),
    // ユーザー一覧
    supabase.from("users").select("*").order("user_name"),
  ]);

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "dashboard").catch(() => {});

  return (
    <MyPageClient
      initialLogs={(myLogsRes.data || []) as ClimbingLog[]}
      rankingLogs={(rankingLogsRes.data || []) as ClimbingLog[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
    />
  );
}
