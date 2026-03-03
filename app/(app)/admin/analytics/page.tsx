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

  // ログタブ用: 7日分
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [accessLogsRes, pageViewsRes, recentLogsRes] = await Promise.all([
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
    // 直近7日のイベントログ
    supabase
      .from("page_views")
      .select("user_name, page, action, created_at")
      .gte("created_at", cutoff7d)
      .neq("user_name", adminName)
      .order("created_at", { ascending: false }),
  ]);

  const accessLogs = accessLogsRes.data || [];
  const pageViews = pageViewsRes.data || [];
  const recentLogs = recentLogsRes.data || [];

  const pageLoads = pageViews.filter((pv) => !pv.action);
  const actionRecords = pageViews.filter((pv) => !!pv.action);

  const days14 = lastNDays(14);
  const sevenDaysAgo = lastNDays(8)[0];

  // --- 日別アクセス数 ---
  const accessByDay: Record<string, number> = {};
  for (const log of accessLogs) {
    const d = toJSTDate(log.created_at);
    accessByDay[d] = (accessByDay[d] || 0) + 1;
  }
  const dailyAccess = days14.map((date) => ({ date, count: accessByDay[date] || 0 }));

  // --- 日別ページビュー数 ---
  const pvByDay: Record<string, number> = {};
  for (const pv of pageLoads) {
    const d = toJSTDate(pv.created_at);
    pvByDay[d] = (pvByDay[d] || 0) + 1;
  }
  const dailyPageViews = days14.map((date) => ({ date, count: pvByDay[date] || 0 }));

  // --- ページ別PV ---
  const pageCountMap: Record<string, number> = {};
  for (const pv of pageLoads) {
    pageCountMap[pv.page] = (pageCountMap[pv.page] || 0) + 1;
  }
  const pageViewCounts = Object.entries(pageCountMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  // --- アクション別カウント ---
  const actionMap: Record<string, number> = {};
  for (const pv of actionRecords) {
    // パイプ区切りの詳細は除去してベースアクション名で集計
    const base = pv.action.split("|")[0];
    actionMap[base] = (actionMap[base] || 0) + 1;
  }
  const actionCounts = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // --- ユーザー別 ---
  const lastAccessMap: Record<string, string> = {};
  for (const log of accessLogs) {
    const u = log.user_name;
    if (!lastAccessMap[u] || log.created_at > lastAccessMap[u]) {
      lastAccessMap[u] = log.created_at;
    }
  }

  const allUsers = Array.from(
    new Set([
      ...accessLogs.map((l) => l.user_name),
      ...pageLoads.map((p) => p.user_name),
    ])
  );

  const userStats = allUsers
    .map((user) => ({
      user,
      accessCount: accessLogs.filter((l) => l.user_name === user).length,
      lastAccessDate: lastAccessMap[user] ? toJSTDate(lastAccessMap[user]) : "—",
      pvHome: pageLoads.filter((p) => p.user_name === user && p.page === "home").length,
      pvDashboard: pageLoads.filter((p) => p.user_name === user && p.page === "dashboard").length,
      pvGyms: pageLoads.filter((p) => p.user_name === user && p.page === "gyms").length,
      pvPlan: pageLoads.filter((p) => p.user_name === user && p.page === "plan").length,
      pvGraph: pageLoads.filter((p) => p.user_name === user && p.page === "graph").length,
    }))
    .sort((a, b) => b.accessCount - a.accessCount);

  // サマリー
  const uniqueUsers30d = new Set(accessLogs.map((l) => l.user_name)).size;
  const uniqueUsers7d = new Set(
    accessLogs
      .filter((l) => toJSTDate(l.created_at) >= sevenDaysAgo)
      .map((l) => l.user_name)
  ).size;

  const props: AnalyticsProps = {
    summary: {
      totalAccess: accessLogs.length,
      totalPageViews: pageLoads.length,
      uniqueUsers30d,
      uniqueUsers7d,
    },
    dailyAccess,
    dailyPageViews,
    pageViewCounts,
    actionCounts,
    userStats,
    recentLogs,
  };

  return <AnalyticsDashboard {...props} />;
}
