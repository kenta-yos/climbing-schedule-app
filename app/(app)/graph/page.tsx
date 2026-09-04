import { GraphClient } from "@/components/graph/GraphClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getTodayJST, toJSTDateString } from "@/lib/utils";
import { trackAction } from "@/lib/analytics";
import type { ClimbingLog, User } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const decodedUser = requireUser();

  const supabase = createClient();

  // 過去12ヶ月分を取得（クライアント側で期間フィルタ）
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoffStr = toJSTDateString(twelveMonthsAgo);

  const todayStr = getTodayJST();

  const [logsRes, plansRes, usersRes] = await Promise.all([
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("type", "実績")
      .gte("date", cutoffStr)
      .order("date", { ascending: false }),
    // 全ユーザーの直近の予定（次の予定を表示するため）
    supabase
      .from("climbing_logs")
      .select("*")
      .eq("type", "予定")
      .gte("date", todayStr)
      .order("date", { ascending: true }),
    supabase.from("users").select("*").order("user_name"),
  ]);

  trackAction(decodedUser, "graph");

  return (
    <GraphClient
      logs={(logsRes.data || []) as ClimbingLog[]}
      plans={(plansRes.data || []) as ClimbingLog[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
    />
  );
}
