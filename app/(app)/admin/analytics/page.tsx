import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import type { AnalyticsProps } from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

const ADMIN_USER_ID = "8779bd4c-be62-49af-9a74-2fa035079ca9";

function toJSTDate(iso: string): string {
  const parts = new Date(iso)
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .split("/");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    const parts = d
      .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
      .split("/");
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  });
}

export default async function AnalyticsPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) notFound();

  const supabase = createClient();
  const decodedUser = decodeURIComponent(userName);

  const { data: adminUser } = await supabase
    .from("users")
    .select("user_name")
    .eq("id", ADMIN_USER_ID)
    .single();

  if (!adminUser || adminUser.user_name !== decodedUser) {
    notFound();
  }

  const adminName = adminUser.user_name;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.toISOString();

  // イベントログ用: 7日分
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [pageViewsRes, recentLogsRes] = await Promise.all([
    supabase
      .from("page_views")
      .select("user_name, page, action, created_at")
      .gte("created_at", cutoff)
      .neq("user_name", adminName)
      .order("created_at", { ascending: false })
      .limit(5000),
    // 直近48時間のイベントログ
    supabase
      .from("page_views")
      .select("user_name, page, action, created_at")
      .gte("created_at", cutoff7d)
      .neq("user_name", adminName)
      .order("created_at", { ascending: false }),
  ]);

  const pageViews = pageViewsRes.data || [];
  const recentLogs = recentLogsRes.data || [];

  const actionRecords = pageViews.filter((pv) => !!pv.action);

  const days14 = lastNDays(14);

  // --- 日別アクティブユーザー数（page_viewsのユニークユーザー/日） ---
  const dauByDay: Record<string, Set<string>> = {};
  for (const pv of pageViews) {
    const d = toJSTDate(pv.created_at);
    if (!dauByDay[d]) dauByDay[d] = new Set();
    dauByDay[d].add(pv.user_name);
  }
  const dailyActiveUsers = days14.map((date) => ({ date, count: dauByDay[date]?.size || 0 }));

  // --- 日別ページビュー数（page_views全件） ---
  const pvByDay: Record<string, number> = {};
  for (const pv of pageViews) {
    const d = toJSTDate(pv.created_at);
    pvByDay[d] = (pvByDay[d] || 0) + 1;
  }
  const dailyPageViews = days14.map((date) => ({ date, count: pvByDay[date] || 0 }));

  // --- ページ別PV（page_views全件） ---
  const pageCountMap: Record<string, number> = {};
  for (const pv of pageViews) {
    pageCountMap[pv.page] = (pageCountMap[pv.page] || 0) + 1;
  }
  const pageViewCounts = Object.entries(pageCountMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  // --- アクション別カウント ---
  const actionMap: Record<string, number> = {};
  for (const pv of actionRecords) {
    const base = pv.action.split("|")[0];
    actionMap[base] = (actionMap[base] || 0) + 1;
  }
  const actionCounts = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // --- ユーザー別（page_viewsベース） ---
  const lastAccessMap: Record<string, string> = {};
  for (const pv of pageViews) {
    const u = pv.user_name;
    if (!lastAccessMap[u] || pv.created_at > lastAccessMap[u]) {
      lastAccessMap[u] = pv.created_at;
    }
  }

  const allUsers = Array.from(new Set(pageViews.map((p) => p.user_name)));

  const userStats = allUsers
    .map((user) => {
      const userPvs = pageViews.filter((p) => p.user_name === user);
      return {
        user,
        accessCount: userPvs.length,
        lastAccessDate: lastAccessMap[user] ? toJSTDate(lastAccessMap[user]) : "—",
        pvHome: userPvs.filter((p) => p.page === "home").length,
        pvDashboard: userPvs.filter((p) => p.page === "dashboard").length,
        pvGyms: userPvs.filter((p) => p.page === "gyms").length,
        pvPlan: userPvs.filter((p) => p.page === "plan").length,
        pvGraph: userPvs.filter((p) => p.page === "graph").length,
        pvAdmin: userPvs.filter((p) => p.page === "admin").length,
      };
    })
    .sort((a, b) => b.accessCount - a.accessCount);

  // --- 予定操作ログ（30日分） ---
  const CLIMBING_ACTIONS = ["plan_created", "log_created", "plan_updated", "plan_deleted"];
  const climbingActions = actionRecords
    .filter((pv) => CLIMBING_ACTIONS.includes(pv.action.split("|")[0]))
    .map((pv) => ({
      user_name: pv.user_name,
      action: pv.action,
      created_at: pv.created_at,
    }));

  const props: AnalyticsProps = {
    summary: {
      totalPageViews: pageViews.length,
      uniqueUsers: allUsers.length,
    },
    dailyActiveUsers,
    dailyPageViews,
    pageViewCounts,
    actionCounts,
    userStats,
    recentLogs,
    climbingActions,
  };

  return <AnalyticsDashboard {...props} />;
}
