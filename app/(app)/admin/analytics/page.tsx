import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { toJSTDateString, getDateOffsetJST, getTodayJST, formatJST } from "@/lib/utils";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { AnalyticsProps } from "@/components/admin/AnalyticsDashboard";
import {
  analyzeImpact,
  mergeEventSources,
  type ImpactLog,
  type PlanEventRow,
  type ActionRow,
} from "@/lib/impact";

export const dynamic = "force-dynamic";

const toJSTDate = (iso: string) => toJSTDateString(new Date(iso));

// 直近 n 日分の日付文字列（古い順）
function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => getDateOffsetJST(-(n - 1 - i)));
}

export default async function AnalyticsPage() {
  const decodedUser = getCurrentUser();
  if (!decodedUser) notFound();

  if (!(await isAdminUser(decodedUser))) notFound();

  const supabase = createClient();
  const adminName = decodedUser;
  const today = getTodayJST();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = cutoffDate.toISOString();

  // ログタブ用: 48時間
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [pageViews, recentLogs, climbingLogs, planEvents, actionRows] = await Promise.all([
    fetchAllRows<{ user_name: string; page: string; action: string | null; created_at: string }>((from, to) =>
      supabase
        .from("page_views")
        .select("user_name, page, action, created_at")
        .gte("created_at", cutoff)
        .neq("user_name", adminName)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    // 直近48時間のイベントログ
    fetchAllRows<{ user_name: string; page: string; action: string | null; created_at: string }>((from, to) =>
      supabase
        .from("page_views")
        .select("user_name, page, action, created_at")
        .gte("created_at", cutoff48h)
        .neq("user_name", adminName)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    // 効果測定用: 実績の突き合わせに使う。予定行は削除されるので当てにしない
    fetchAllRows<ImpactLog>((from, to) =>
      supabase
        .from("climbing_logs")
        .select("date, gym_name, user, type, created_at")
        .eq("type", "実績")
        .order("date", { ascending: false })
        .range(from, to)
    ),
    // 効果測定用: 募集と参加の証跡（追記専用）
    fetchAllRows<PlanEventRow>((from, to) =>
      supabase
        .from("plan_events")
        .select("kind, date, gym_name, user, actor, source, prev_date, prev_gym_name, created_at")
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    // 効果測定用: plan_events を入れる前の分を page_views から復元する。
    // ここは管理者も 1 メンバーとして数えるので user_name で絞らない
    fetchAllRows<ActionRow>((from, to) =>
      supabase
        .from("page_views")
        .select("user_name, action, created_at")
        .not("action", "is", null)
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
  ]);

  const actionRecords = pageViews.filter((pv): pv is typeof pv & { action: string } => !!pv.action);

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
  const CLIMBING_ACTIONS = ["plan_created", "log_created", "plan_updated", "plan_deleted", "plan_joined"];
  const climbingActions = actionRecords
    .filter((pv) => CLIMBING_ACTIONS.includes(pv.action.split("|")[0]))
    .map((pv) => ({
      user_name: pv.user_name,
      action: pv.action,
      created_at: pv.created_at,
    }));

  // --- 効果測定 ---
  // plan_events を入れる前の期間は page_views の action から復元する。
  // page_views と違い、こちらは管理者も 1 メンバーとして数える
  const { events, cutover } = mergeEventSources(planEvents, actionRows);

  const impacts = [
    { label: "30日", days: 30 },
    { label: "90日", days: 90 },
    { label: "6ヶ月", days: 180 },
    // 全期間といっても GROUP_ROLLOUT_DATE より前には遡らない
    { label: "全期間", days: null },
  ].map(({ label, days }) =>
    analyzeImpact(events, climbingLogs, {
      label,
      sinceDate: days === null ? undefined : getDateOffsetJST(-days),
      cutover,
      today,
    })
  );

  // 参加パネルのファネル（過去30日・管理者も含む）
  const since30 = Date.parse(cutoff);
  const recentActions = actionRows.filter((a) => Date.parse(a.created_at) >= since30);
  const countAction = (name: string) =>
    recentActions.filter((a) => a.action.split("|")[0] === name).length;
  const joinFunnel = {
    joinTapped: countAction("join_tapped") + countAction("shift_join_tapped"),
    planJoined: countAction("plan_joined"),
    planCreated: countAction("plan_created"),
  };

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
    impacts,
    joinFunnel,
    // 数字は固定値ではなくこの時点のスナップショット。force-dynamic なので毎回引き直す
    renderedAt: formatJST(new Date(), "M/d HH:mm"),
  };

  return <AnalyticsDashboard {...props} />;
}
