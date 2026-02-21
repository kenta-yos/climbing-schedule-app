import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import type { AnalyticsProps } from "@/components/admin/AnalyticsDashboard";

export const dynamic = "force-dynamic";

const ADMIN_USER_ID = "8779bd4c-be62-49af-9a74-2fa035079ca9";

// JST日付文字列（YYYY-MM-DD）に変換
function toJSTDate(iso: string): string {
  const parts = new Date(iso)
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
    .split("/");
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

// 直近N日の日付リスト（古い順）
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

  // UUIDでアドミンユーザーを確認
  const { data: adminUser } = await supabase
    .from("users")
    .select("user_name")
    .eq("id", ADMIN_USER_ID)
    .single();

  if (!adminUser || adminUser.user_name !== decodedUser) {
    notFound();
  }

  const adminName = adminUser.user_name;

  // 過去30日のカットオフ
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.toISOString();
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const [accessLogsRes, pageViewsRes, climbingLogsRes] = await Promise.all([
    supabase
      .from("access_logs")
      .select("user_name, created_at")
      .gte("created_at", cutoff)
      .neq("user_name", adminName)
      .order("created_at", { ascending: false }),
    supabase
      .from("page_views")
      .select("user_name, page, action, created_at")
      .gte("created_at", cutoff)
      .neq("user_name", adminName)
      .order("created_at", { ascending: false }),
    // 全期間のクライミングログ（adminユーザー除外）
    supabase
      .from("climbing_logs")
      .select("user, type, date")
      .neq("user", adminName),
  ]);

  const accessLogs = accessLogsRes.data || [];
  const pageViews = pageViewsRes.data || [];
  const climbingLogs = climbingLogsRes.data || [];

  // ページロード（action=null）とアクション記録を分離
  // page_viewsにはaddPageView（action=null）とtrackAction（action!=null）の両方が混在している
  const pageLoads = pageViews.filter((pv) => !pv.action);
  const actionRecords = pageViews.filter((pv) => !!pv.action);

  const days14 = lastNDays(14);
  // 7日前の日付（lastNDays(8)の最初の要素 = 7日前）
  const sevenDaysAgo = lastNDays(8)[0];

  // --- 日別集計 ---

  // 日別ログイン数
  const loginByDay: Record<string, number> = {};
  for (const log of accessLogs) {
    const d = toJSTDate(log.created_at);
    loginByDay[d] = (loginByDay[d] || 0) + 1;
  }
  const dailyLogins = days14.map((date) => ({ date, count: loginByDay[date] || 0 }));

  // 日別ページビュー数（pageLoadsのみカウント）
  const pvByDay: Record<string, number> = {};
  for (const pv of pageLoads) {
    const d = toJSTDate(pv.created_at);
    pvByDay[d] = (pvByDay[d] || 0) + 1;
  }
  const dailyPageViews = days14.map((date) => ({ date, count: pvByDay[date] || 0 }));

  // ページ別PV（pageLoadsのみ）
  const pageCountMap: Record<string, number> = {};
  for (const pv of pageLoads) {
    pageCountMap[pv.page] = (pageCountMap[pv.page] || 0) + 1;
  }
  const pageViewCounts = Object.entries(pageCountMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  // アクション別カウント（actionRecordsのみ）
  const actionMap: Record<string, number> = {};
  for (const pv of actionRecords) {
    actionMap[pv.action] = (actionMap[pv.action] || 0) + 1;
  }
  const actionCounts = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // クライミングログ集計
  const plans30d = climbingLogs.filter((l) => l.type === "予定" && l.date >= cutoffDateStr).length;
  const logs30d = climbingLogs.filter((l) => l.type === "実績" && l.date >= cutoffDateStr).length;
  const plansTotal = climbingLogs.filter((l) => l.type === "予定").length;
  const logsTotal = climbingLogs.filter((l) => l.type === "実績").length;

  // ユーザー別サマリー（アクセスログ・ページビュー・クライミングログ全てのユニークユーザー）
  const allUsers = Array.from(
    new Set([
      ...accessLogs.map((l) => l.user_name),
      ...pageLoads.map((p) => p.user_name),
      ...climbingLogs.map((l) => l.user),
    ])
  );

  const userStats = allUsers
    .map((user) => ({
      user,
      logins: accessLogs.filter((l) => l.user_name === user).length,
      pvHome: pageLoads.filter((p) => p.user_name === user && p.page === "home").length,
      pvDashboard: pageLoads.filter((p) => p.user_name === user && p.page === "dashboard").length,
      pvGyms: pageLoads.filter((p) => p.user_name === user && p.page === "gyms").length,
      pvPlan: pageLoads.filter((p) => p.user_name === user && p.page === "plan").length,
      plans30d: climbingLogs.filter(
        (l) => l.user === user && l.type === "予定" && l.date >= cutoffDateStr
      ).length,
      logs30d: climbingLogs.filter(
        (l) => l.user === user && l.type === "実績" && l.date >= cutoffDateStr
      ).length,
      plansTotal: climbingLogs.filter((l) => l.user === user && l.type === "予定").length,
      logsTotal: climbingLogs.filter((l) => l.user === user && l.type === "実績").length,
    }))
    .sort((a, b) => b.logins - a.logins);

  // サマリー
  const uniqueUsers30d = new Set(accessLogs.map((l) => l.user_name)).size;
  const uniqueUsers7d = new Set(
    accessLogs
      .filter((l) => toJSTDate(l.created_at) >= sevenDaysAgo)
      .map((l) => l.user_name)
  ).size;

  const props: AnalyticsProps = {
    summary: {
      totalLogins: accessLogs.length,
      totalPageViews: pageLoads.length,
      uniqueUsers30d,
      uniqueUsers7d,
      plans30d,
      logs30d,
      plansTotal,
      logsTotal,
    },
    dailyLogins,
    dailyPageViews,
    pageViewCounts,
    actionCounts,
    userStats,
  };

  return <AnalyticsDashboard {...props} />;
}
