import { HomeClient } from "@/components/home/HomeClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog, GymMaster, AreaMaster, User, Announcement } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();

  // トップページは「今日以降3週間分の予定」と「今月の実績」のみ取得
  const todayStr = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-").replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + 21);
  const cutoffStr = cutoffDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-").replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
  // 先月1日（ランキングの先月タブ用）
  const nowDate = new Date();
  const lastMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const monthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const [futurePlansRes, monthlyLogsRes, gymsRes, areasRes, usersRes, announcementsRes] = await Promise.all([
    // 今日〜3週間後の予定
    supabase.from("climbing_logs").select("*").eq("type", "予定").gte("date", todayStr).lte("date", cutoffStr).order("date", { ascending: true }),
    // 今月の実績（MonthlyRankingに使用）
    supabase.from("climbing_logs").select("*").eq("type", "実績").gte("date", monthStart).order("date", { ascending: false }),
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("area_tag"),
    supabase.from("users").select("*").order("user_name"),
    supabase.from("release_announcements").select("*").gte("display_until", todayStr).order("created_at", { ascending: false }),
  ]);

  const initialLogs = [...(futurePlansRes.data || []), ...(monthlyLogsRes.data || [])];

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "home").catch(() => {});

  return (
    <HomeClient
      initialLogs={initialLogs as ClimbingLog[]}
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
      announcements={(announcementsRes.data || []) as Announcement[]}
    />
  );
}
