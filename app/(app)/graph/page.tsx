import { GraphClient } from "@/components/graph/GraphClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog, User } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();

  // 過去12ヶ月分を取得（クライアント側で期間フィルタ）
  const jstDate = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const cutoffStr = jstDate(twelveMonthsAgo);

  const todayStr = jstDate(new Date());

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

  addPageView(decodedUser, "graph").catch(() => {});

  return (
    <GraphClient
      logs={(logsRes.data || []) as ClimbingLog[]}
      plans={(plansRes.data || []) as ClimbingLog[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
    />
  );
}
