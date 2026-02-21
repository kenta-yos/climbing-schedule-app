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

// 直近N日の日付リスト（新しい順）
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

  // 過去30日のデータ取得
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.toISOString();

  const [accessLogsRes, pageViewsRes] = await Promise.all([
    supabase
      .from("access_logs")
      .select("user_name, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false }),
    supabase
      .from("page_views")
      .select("user_name, page, action, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false }),
  ]);

  const accessLogs = accessLogsRes.data || [];
  const pageViews = pageViewsRes.data || [];

  const days14 = lastNDays(14);
  const days7Start = days14[7]; // 7日前の日付

  // --- 集計 ---

  // 日別ログイン数
  const loginByDay: Record<string, number> = {};
  for (const log of accessLogs) {
    const d = toJSTDate(log.created_at);
    loginByDay[d] = (loginByDay[d] || 0) + 1;
  }
  const dailyLogins = days14.map((date) => ({ date, count: loginByDay[date] || 0 }));

  // 日別ページビュー数
  const pvByDay: Record<string, number> = {};
  for (const pv of pageViews) {
    const d = toJSTDate(pv.created_at);
    pvByDay[d] = (pvByDay[d] || 0) + 1;
  }
  const dailyPageViews = days14.map((date) => ({ date, count: pvByDay[date] || 0 }));

  // ページ別PV
  const pageCountMap: Record<string, number> = {};
  for (const pv of pageViews) {
    pageCountMap[pv.page] = (pageCountMap[pv.page] || 0) + 1;
  }
  const pageViewCounts = Object.entries(pageCountMap)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  // アクション別カウント
  const actionMap: Record<string, number> = {};
  for (const pv of pageViews) {
    if (pv.action) {
      actionMap[pv.action] = (actionMap[pv.action] || 0) + 1;
    }
  }
  const actionCounts = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // ユーザー別サマリー
  const allUsers = [
    ...new Set([
      ...accessLogs.map((l) => l.user_name),
      ...pageViews.map((p) => p.user_name),
    ]),
  ];
  const userStats = allUsers
    .map((user) => ({
      user,
      logins: accessLogs.filter((l) => l.user_name === user).length,
      pageViews: pageViews.filter((p) => p.user_name === user).length,
      actions: pageViews.filter((p) => p.user_name === user && p.action).length,
    }))
    .sort((a, b) => b.logins - a.logins);

  // サマリー
  const uniqueUsers30d = new Set(accessLogs.map((l) => l.user_name)).size;
  const uniqueUsers7d = new Set(
    accessLogs
      .filter((l) => toJSTDate(l.created_at) >= days7Start)
      .map((l) => l.user_name)
  ).size;

  const props: AnalyticsProps = {
    summary: {
      totalLogins: accessLogs.length,
      totalPageViews: pageViews.length,
      uniqueUsers30d,
      uniqueUsers7d,
    },
    dailyLogins,
    dailyPageViews,
    pageViewCounts,
    actionCounts,
    userStats,
  };

  return <AnalyticsDashboard {...props} />;
}
