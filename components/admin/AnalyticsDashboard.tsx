"use client";

import { useState } from "react";

export type AnalyticsProps = {
  summary: {
    totalPageViews: number;
    uniqueUsers: number;
  };
  dailyActiveUsers: { date: string; count: number }[];
  dailyPageViews: { date: string; count: number }[];
  pageViewCounts: { page: string; count: number }[];
  actionCounts: { action: string; count: number }[];
  userStats: {
    user: string;
    accessCount: number;
    lastAccessDate: string;
    pvHome: number;
    pvDashboard: number;
    pvGyms: number;
    pvPlan: number;
    pvGraph: number;
    pvAdmin: number;
  }[];
  recentLogs: { user_name: string; page: string; action: string | null; created_at: string }[];
  climbingActions: { user_name: string; action: string; created_at: string }[];
};

type Tab = "events" | "logs" | "actions" | "users";

function formatJST(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── 共通UIパーツ ──────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5 h-20 w-full">
        {data.map(({ date, count }) => (
          <div key={date} className="flex-1 h-full flex flex-col items-center justify-end">
            {count > 0 && (
              <span className="text-[7px] text-gray-500 font-medium mb-0.5">{count}</span>
            )}
            <div
              className="w-full bg-orange-400 rounded-t-sm"
              style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-0.5">
        {data.map(({ date }) => (
          <div key={date} className="flex-1 text-center">
            <span className="text-[7px] text-gray-400 leading-none">{date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBarChart({ items, color = "bg-orange-400" }: { items: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-36 flex-shrink-0 truncate">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-8 text-right flex-shrink-0">{count}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({ label, value, color = "text-gray-800" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
      <p className="text-[10px] text-gray-400 mb-1 leading-tight">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── ラベル定義 ──────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  home: "🏠 トップ",
  dashboard: "👤 マイページ",
  gyms: "🏢 ジム",
  plan: "📝 予定入力",
  graph: "🔗 つながり",
  admin: "⚙️ 管理",
};

const ACTION_LABELS: Record<string, string> = {
  // トップ
  record_tapped: "記録ボタン押下",
  join_tapped: "参加ボタン押下",
  plan_joined: "参加確定",
  edit_tapped: "編集ボタン押下",
  // 予定・記録
  plan_created: "予定作成",
  log_created: "実績登録",
  plan_updated: "予定更新",
  plan_deleted: "予定削除",
  gym_selected_search: "ジム：検索から選択",
  gym_selected_recent: "ジム：よく行くから選択",
  gym_selected_undecided: "ジム：未定で登録",
  // ジムページ
  sort_distance: "ソート：近い順",
  sort_freshset: "ソート：新セット順",
  sort_overdue: "ソート：ご無沙汰順",
  gps_auto: "GPS自動取得",
  gps_button: "GPSボタン使用",
  address_set: "住所手入力",
  nationwide_on: "全国表示ON",
  nationwide_off: "全国表示OFF",
  load_more: "もっと見る押下",
};

// アクションをページごとにグループ化
function categorizeActions(actionCounts: { action: string; count: number }[]) {
  const home = actionCounts.filter((a) =>
    ["record_tapped", "join_tapped", "plan_joined", "edit_tapped"].includes(a.action)
  );
  const plan = actionCounts.filter((a) =>
    ["plan_created", "log_created", "plan_updated", "plan_deleted",
     "gym_selected_search", "gym_selected_recent", "gym_selected_undecided"].includes(a.action)
  );
  const gyms = actionCounts.filter((a) =>
    ["sort_distance", "sort_freshset", "sort_overdue",
     "gps_auto", "gps_button", "address_set",
     "nationwide_on", "nationwide_off", "load_more"].includes(a.action)
  );
  return { home, plan, gyms };
}

// ─── ログタブ用: アクション詳細をパース ──────────────────────────────────────

type ActionDetail = {
  base: string;
  date: string | null;
  gym: string | null;
  companions: string | null;
};

function parseActionDetail(action: string): ActionDetail {
  const parts = action.split("|");
  const base = parts[0];
  return {
    base,
    date: parts[1] || null,
    gym: parts[2] || null,
    companions: parts[3] || null,
  };
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export function AnalyticsDashboard({
  summary,
  dailyActiveUsers,
  dailyPageViews,
  pageViewCounts,
  actionCounts,
  userStats,
  recentLogs,
  climbingActions,
}: AnalyticsProps) {
  const [tab, setTab] = useState<Tab>("events");
  const { home, plan, gyms } = categorizeActions(actionCounts);

  const tabs: { key: Tab; label: string }[] = [
    { key: "events", label: "ログ" },
    { key: "logs", label: "記録ログ" },
    { key: "actions", label: "アクション" },
    { key: "users", label: "ユーザー" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <span className="text-sm font-bold flex-1 text-gray-900">Analytics</span>
        <span className="text-[10px] text-gray-400">過去30日 / admin除外</span>
      </div>

      {/* サマリーカード（常時表示） */}
      <div className="px-4 pt-3 pb-1">
        <div className="grid grid-cols-2 gap-2">
          <SummaryCard label="PV（30日）" value={summary.totalPageViews} color="text-orange-500" />
          <SummaryCard label="ユーザー数（30日）" value={summary.uniqueUsers} color="text-blue-500" />
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[calc(44px+env(safe-area-inset-top))] z-10">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === key ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ===== ログタブ（メイン） ===== */}
        {tab === "events" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-700">直近48時間のログ</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {recentLogs.length}件 ／ ページ遷移 + アクション
              </p>
            </div>
            {recentLogs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">データがありません</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[80vh] overflow-y-auto">
                {recentLogs.map((log, i) => {
                  const parsed = log.action ? parseActionDetail(log.action) : null;
                  const isClimbAction = parsed && ["plan_created", "log_created", "plan_updated", "plan_deleted"].includes(parsed.base);
                  const detailText = parsed
                    ? [parsed.date?.slice(5).replace("-", "/"), parsed.gym, parsed.companions ? `(${parsed.companions})` : null].filter(Boolean).join(" ")
                    : null;
                  return (
                    <div key={i} className={`flex items-start px-4 py-2.5 gap-2 ${isClimbAction ? "bg-orange-50/50" : ""}`}>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap w-[88px] flex-shrink-0 pt-0.5">
                        {formatJST(log.created_at)}
                      </span>
                      <span className="text-xs font-medium text-gray-700 w-16 flex-shrink-0 truncate pt-0.5">
                        {log.user_name}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {PAGE_LABELS[log.page] || log.page}
                        </span>
                        {parsed ? (
                          <div>
                            <span className={`text-[10px] font-medium ${isClimbAction ? "text-orange-600" : "text-blue-500"}`}>
                              {ACTION_LABELS[parsed.base] || parsed.base}
                            </span>
                            {detailText && (
                              <span className="text-[10px] text-gray-400 ml-1">
                                {detailText}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-300">ページ遷移</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 記録ログタブ ===== */}
        {tab === "logs" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-700">予定・実績の操作ログ</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {climbingActions.length}件 ／ 過去30日
              </p>
            </div>
            {climbingActions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">データがありません</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[80vh] overflow-y-auto">
                {climbingActions.map((log, i) => {
                  const parsed = parseActionDetail(log.action);
                  return (
                    <div key={i} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {formatJST(log.created_at)}
                        </span>
                        <span className="text-xs font-medium text-gray-700 truncate">
                          {log.user_name}
                        </span>
                        <span className="text-[10px] font-medium text-orange-600 whitespace-nowrap">
                          {ACTION_LABELS[parsed.base] || parsed.base}
                        </span>
                      </div>
                      {(parsed.date || parsed.gym || parsed.companions) && (
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 pl-1 flex-wrap">
                          {parsed.date && (
                            <span>📅 {parsed.date.slice(5).replace("-", "/")}</span>
                          )}
                          {parsed.gym && (
                            <span className="font-medium text-gray-600">🏢 {parsed.gym}</span>
                          )}
                          {parsed.companions && (
                            <span>👥 {parsed.companions}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== アクションタブ ===== */}
        {tab === "actions" && (
          <>
            {/* 日別トレンド */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">日別アクティブユーザー数（14日）</p>
              <BarChart data={dailyActiveUsers} />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">日別ページビュー（14日）</p>
              <BarChart data={dailyPageViews} />
            </div>

            {/* ページ別PV */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">ページ別ビュー数</p>
              <HBarChart
                items={pageViewCounts.map(({ page, count }) => ({
                  label: PAGE_LABELS[page] || page,
                  count,
                }))}
              />
            </div>

            {/* トップページ */}
            {home.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">🏠 トップページの操作</p>
                <HBarChart
                  items={home.map(({ action, count }) => ({ label: ACTION_LABELS[action] || action, count }))}
                  color="bg-blue-400"
                />
              </div>
            )}

            {/* 予定・記録 */}
            {plan.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">📝 予定・記録の操作</p>
                <HBarChart
                  items={plan.map(({ action, count }) => ({ label: ACTION_LABELS[action] || action, count }))}
                  color="bg-green-400"
                />
              </div>
            )}

            {/* ジムページ */}
            {gyms.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">🏢 ジムページの操作</p>
                <HBarChart
                  items={gyms.map(({ action, count }) => ({ label: ACTION_LABELS[action] || action, count }))}
                  color="bg-purple-400"
                />
              </div>
            )}

            {actionCounts.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">アクションデータがありません</div>
            )}
          </>
        )}

        {/* ===== ユーザータブ ===== */}
        {tab === "users" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-700">ユーザー別PV（過去30日）</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                PV数・最終アクセス日・各ページのビュー数
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 sticky left-0 bg-gray-50 min-w-[80px]">
                      ユーザー
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[36px]">
                      PV
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[64px]">
                      最終
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      🏠
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      👤
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      🏢
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      📝
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      🔗
                    </th>
                    <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[28px]">
                      ⚙️
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {userStats.map(({ user, accessCount, lastAccessDate, pvHome, pvDashboard, pvGyms, pvPlan, pvGraph, pvAdmin }) => (
                    <tr key={user}>
                      <td className="px-3 py-2.5 font-medium text-gray-800 sticky left-0 bg-white truncate max-w-[80px]">
                        {user}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-orange-500">{accessCount}</td>
                      <td className="px-2 py-2.5 text-right text-[10px] text-gray-400 whitespace-nowrap">
                        {lastAccessDate.slice(5)}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvHome}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvDashboard}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvGyms}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvPlan}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvGraph}</td>
                      <td className="px-2 py-2.5 text-right text-gray-600">{pvAdmin}</td>
                    </tr>
                  ))}
                  {userStats.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-400">データなし</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
