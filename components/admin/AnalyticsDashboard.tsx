"use client";

import { useState } from "react";

export type AnalyticsProps = {
  summary: {
    totalLogins: number;
    totalPageViews: number;
    uniqueUsers30d: number;
    uniqueUsers7d: number;
    plans30d: number;
    logs30d: number;
    plansTotal: number;
    logsTotal: number;
  };
  dailyLogins: { date: string; count: number }[];
  dailyPageViews: { date: string; count: number }[];
  pageViewCounts: { page: string; count: number }[];
  actionCounts: { action: string; count: number }[];
  userStats: {
    user: string;
    logins: number;
    lastAccessDate: string;
    pvHome: number;
    pvDashboard: number;
    pvGyms: number;
    pvPlan: number;
    pvGraph: number;
    plans30d: number;
    logs30d: number;
    plansTotal: number;
    logsTotal: number;
  }[];
  recentLogs: { user_name: string; page: string; created_at: string }[];
};

type Tab = "overview" | "actions" | "users" | "logs";

// JST日時フォーマット（MM/DD HH:mm）
function formatJST(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 棒グラフ（日別トレンド）
function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-24 w-full">
      {data.map(({ date, count }) => (
        <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-orange-400 rounded-t-sm transition-all"
            style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 2 : 0 }}
          />
          <span className="text-[7px] text-gray-400 leading-none">{date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// 水平バーチャート
function HBarChart({
  items,
  color = "bg-orange-400",
}: {
  items: { label: string; count: number }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-36 flex-shrink-0 truncate">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`${color} h-full rounded-full transition-all`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-8 text-right flex-shrink-0">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// アクションをカテゴリ別にグループ化
function categorizeActions(actionCounts: { action: string; count: number }[]) {
  const home = actionCounts.filter((a) =>
    ["record_tapped", "join_tapped", "plan_joined", "edit_tapped"].includes(a.action)
  );
  const plan = actionCounts.filter((a) =>
    [
      "plan_created",
      "log_created",
      "plan_updated",
      "plan_deleted",
      "gym_selected_search",
      "gym_selected_recent",
      "gym_selected_undecided",
    ].includes(a.action)
  );
  const gyms = actionCounts.filter((a) =>
    [
      "sort_distance",
      "sort_freshset",
      "sort_overdue",
      "gps_auto",
      "gps_button",
      "address_set",
      "nationwide_on",
      "nationwide_off",
      "load_more",
    ].includes(a.action)
  );
  const other = actionCounts.filter(
    (a) => ![...home, ...plan, ...gyms].find((x) => x.action === a.action)
  );
  return { home, plan, gyms, other };
}

const ACTION_LABELS: Record<string, string> = {
  record_tapped: "記録ボタン押下",
  join_tapped: "＋参加ボタン",
  plan_joined: "参加確定",
  edit_tapped: "編集ボタン",
  plan_created: "予定作成",
  log_created: "実績登録",
  plan_updated: "予定更新",
  plan_deleted: "予定削除",
  gym_selected_search: "ジム検索から選択",
  gym_selected_recent: "よく行くから選択",
  gym_selected_undecided: "ジム未定で登録",
  sort_distance: "ソート：近い順",
  sort_freshset: "ソート：新セット順",
  sort_overdue: "ソート：ご無沙汰順",
  gps_auto: "GPS自動取得成功",
  gps_button: "GPSボタン使用",
  address_set: "住所手入力",
  nationwide_on: "全国表示ON",
  nationwide_off: "全国表示OFF",
  load_more: "もっと見る",
};

const PAGE_LABELS: Record<string, string> = {
  home: "🏠 ホーム",
  dashboard: "📊 ダッシュボード",
  gyms: "🏢 ジム一覧",
  plan: "📅 予定入力",
  graph: "🕸️ つながり",
  admin: "⚙️ 管理",
};

// サマリーカード
function SummaryCard({
  label,
  value,
  sub,
  color = "text-gray-800",
}: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
      <p className="text-[10px] text-gray-400 mb-1 leading-tight">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function AnalyticsDashboard({
  summary,
  dailyLogins,
  dailyPageViews,
  pageViewCounts,
  actionCounts,
  userStats,
  recentLogs,
}: AnalyticsProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const { home, plan, gyms, other } = categorizeActions(actionCounts);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "概要" },
    { key: "actions", label: "アクション" },
    { key: "users", label: "ユーザー" },
    { key: "logs", label: "ログ" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div
        className="sticky top-0 z-10 bg-gray-900 text-white px-4 py-3 flex items-center gap-2"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <span className="text-sm font-bold flex-1">📈 Analytics</span>
        <span className="text-xs text-gray-400">過去30日 / adminユーザー除外</span>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[calc(44px+env(safe-area-inset-top))] z-10">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === key
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ===== 概要タブ ===== */}
        {tab === "overview" && (
          <>
            {/* アクセス系サマリー */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                アクセス（過去30日）
              </p>
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="ログイン数" value={summary.totalLogins} />
                <SummaryCard label="ページビュー" value={summary.totalPageViews} />
                <SummaryCard
                  label="アクティブユーザー（30日）"
                  value={summary.uniqueUsers30d}
                  color="text-orange-500"
                />
                <SummaryCard
                  label="アクティブユーザー（7日）"
                  value={summary.uniqueUsers7d}
                  color="text-orange-500"
                />
              </div>
            </div>

            {/* クライミング系サマリー */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                クライミング登録
              </p>
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard
                  label="予定（過去30日）"
                  value={summary.plans30d}
                  sub={`累計 ${summary.plansTotal}件`}
                  color="text-blue-500"
                />
                <SummaryCard
                  label="実績（過去30日）"
                  value={summary.logs30d}
                  sub={`累計 ${summary.logsTotal}件`}
                  color="text-green-500"
                />
              </div>
            </div>

            {/* 日別ログイン数 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">📅 日別ログイン数（14日）</p>
              <BarChart data={dailyLogins} />
            </div>

            {/* 日別ページビュー */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">
                📊 日別ページビュー（14日）
                <span className="text-[10px] font-normal text-gray-400 ml-1">
                  ※ページ遷移のみ、アクション記録は除く
                </span>
              </p>
              <BarChart data={dailyPageViews} />
            </div>

            {/* ページ別PV */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">🗂 ページ別ビュー数</p>
              <HBarChart
                items={pageViewCounts.map(({ page, count }) => ({
                  label: PAGE_LABELS[page] || page,
                  count,
                }))}
              />
            </div>
          </>
        )}

        {/* ===== アクションタブ ===== */}
        {tab === "actions" && (
          <>
            {home.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">🏠 ホーム エンゲージメント</p>
                <HBarChart
                  items={home.map(({ action, count }) => ({
                    label: ACTION_LABELS[action] || action,
                    count,
                  }))}
                  color="bg-blue-400"
                />
              </div>
            )}

            {plan.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">📝 記録・予定アクション</p>
                <HBarChart
                  items={plan.map(({ action, count }) => ({
                    label: ACTION_LABELS[action] || action,
                    count,
                  }))}
                  color="bg-green-400"
                />
                {(() => {
                  const search =
                    plan.find((a) => a.action === "gym_selected_search")?.count || 0;
                  const recent =
                    plan.find((a) => a.action === "gym_selected_recent")?.count || 0;
                  const undecided =
                    plan.find((a) => a.action === "gym_selected_undecided")?.count || 0;
                  const total = search + recent + undecided;
                  if (total === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-[10px] text-gray-400 mb-2">ジム選択方法の内訳</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-green-500">
                            {Math.round((search / total) * 100)}%
                          </span>
                          <span className="text-gray-400">検索</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-orange-500">
                            {Math.round((recent / total) * 100)}%
                          </span>
                          <span className="text-gray-400">よく行く</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-gray-400">
                            {Math.round((undecided / total) * 100)}%
                          </span>
                          <span className="text-gray-400">未定</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {gyms.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">🏢 ジム一覧の操作</p>
                <HBarChart
                  items={gyms.map(({ action, count }) => ({
                    label: ACTION_LABELS[action] || action,
                    count,
                  }))}
                  color="bg-purple-400"
                />
                {/* GPS・位置情報利用率 */}
                {(() => {
                  const gpsAuto = gyms.find((a) => a.action === "gps_auto")?.count || 0;
                  const gpsBtn = gyms.find((a) => a.action === "gps_button")?.count || 0;
                  const addr = gyms.find((a) => a.action === "address_set")?.count || 0;
                  const total = gpsAuto + gpsBtn + addr;
                  if (total === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-[10px] text-gray-400 mb-2">出発地の設定方法（位置情報利用率）</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-blue-500">
                            {Math.round((gpsAuto / total) * 100)}%
                          </span>
                          <span className="text-gray-400">GPS自動</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-purple-500">
                            {Math.round((gpsBtn / total) * 100)}%
                          </span>
                          <span className="text-gray-400">GPSボタン</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-gray-400">
                            {Math.round((addr / total) * 100)}%
                          </span>
                          <span className="text-gray-400">住所入力</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {other.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-3">その他のアクション</p>
                <HBarChart
                  items={other.map(({ action, count }) => ({
                    label: ACTION_LABELS[action] || action,
                    count,
                  }))}
                />
              </div>
            )}

            {/* コンバージョン */}
            {(() => {
              const joinTapped =
                actionCounts.find((a) => a.action === "join_tapped")?.count || 0;
              const planJoined =
                actionCounts.find((a) => a.action === "plan_joined")?.count || 0;
              const recordTapped =
                actionCounts.find((a) => a.action === "record_tapped")?.count || 0;
              const planCreated =
                actionCounts.find((a) => a.action === "plan_created")?.count || 0;
              const logCreated =
                actionCounts.find((a) => a.action === "log_created")?.count || 0;
              return (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-3">🔄 コンバージョン</p>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">参加ボタン → 参加確定</span>
                        <span className="font-bold text-gray-700">
                          {joinTapped > 0
                            ? `${Math.round((planJoined / joinTapped) * 100)}%`
                            : "—"}
                          <span className="text-gray-400 font-normal ml-1">
                            ({planJoined}/{joinTapped})
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-orange-400 h-full rounded-full"
                          style={{
                            width:
                              joinTapped > 0
                                ? `${(planJoined / joinTapped) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">記録ボタン → 予定/実績登録</span>
                        <span className="font-bold text-gray-700">
                          {recordTapped > 0
                            ? `${Math.round(((planCreated + logCreated) / recordTapped) * 100)}%`
                            : "—"}
                          <span className="text-gray-400 font-normal ml-1">
                            ({planCreated + logCreated}/{recordTapped})
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-400 h-full rounded-full"
                          style={{
                            width:
                              recordTapped > 0
                                ? `${((planCreated + logCreated) / recordTapped) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {actionCounts.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                アクションデータがありません
              </div>
            )}
          </>
        )}

        {/* ===== ユーザータブ ===== */}
        {tab === "users" && (
          <>
            {/* ページビュー内訳（ユーザー別） */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-700">📊 ページ閲覧（過去30日）</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  最終アクセス日・ログイン回数・各ページのビュー数
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 sticky left-0 bg-gray-50 min-w-[90px]">
                        ユーザー
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[64px]">
                        最終アクセス
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[44px]">
                        ログイン
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[32px]">
                        🏠
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[32px]">
                        📊
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[32px]">
                        🏢
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[32px]">
                        📅
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[32px]">
                        🕸️
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {userStats.map(
                      ({ user, logins, lastAccessDate, pvHome, pvDashboard, pvGyms, pvPlan, pvGraph }) => (
                        <tr key={user}>
                          <td className="px-3 py-2.5 font-medium text-gray-800 sticky left-0 bg-white truncate max-w-[90px]">
                            {user}
                          </td>
                          <td className="px-2 py-2.5 text-right text-[10px] text-gray-400 whitespace-nowrap">
                            {lastAccessDate}
                          </td>
                          <td className="px-2 py-2.5 text-right font-bold text-orange-500">
                            {logins}
                          </td>
                          <td className="px-2 py-2.5 text-right text-gray-600">{pvHome}</td>
                          <td className="px-2 py-2.5 text-right text-gray-600">{pvDashboard}</td>
                          <td className="px-2 py-2.5 text-right text-gray-600">{pvGyms}</td>
                          <td className="px-2 py-2.5 text-right text-gray-600">{pvPlan}</td>
                          <td className="px-2 py-2.5 text-right text-gray-600">{pvGraph}</td>
                        </tr>
                      )
                    )}
                    {userStats.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-gray-400">
                          データなし
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* クライミング登録数（ユーザー別） */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-700">🧗 クライミング登録数</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  過去30日の予定・実績（累計）
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left text-[10px] font-semibold text-gray-400 px-3 py-2 sticky left-0 bg-gray-50 min-w-[90px]">
                        ユーザー
                      </th>
                      <th className="text-right text-[10px] font-semibold text-blue-400 px-2 py-2 min-w-[52px]">
                        予定(30d)
                      </th>
                      <th className="text-right text-[10px] font-semibold text-green-400 px-2 py-2 min-w-[52px]">
                        実績(30d)
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[44px]">
                        予定(計)
                      </th>
                      <th className="text-right text-[10px] font-semibold text-gray-400 px-2 py-2 min-w-[44px]">
                        実績(計)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {userStats
                      .slice()
                      .sort(
                        (a, b) =>
                          b.plansTotal + b.logsTotal - (a.plansTotal + a.logsTotal)
                      )
                      .map(({ user, plans30d, logs30d, plansTotal, logsTotal }) => (
                        <tr key={user}>
                          <td className="px-3 py-2.5 font-medium text-gray-800 sticky left-0 bg-white truncate max-w-[90px]">
                            {user}
                          </td>
                          <td className="px-2 py-2.5 text-right font-bold text-blue-500">
                            {plans30d}
                          </td>
                          <td className="px-2 py-2.5 text-right font-bold text-green-500">
                            {logs30d}
                          </td>
                          <td className="px-2 py-2.5 text-right text-gray-500">{plansTotal}</td>
                          <td className="px-2 py-2.5 text-right text-gray-500">{logsTotal}</td>
                        </tr>
                      ))}
                    {userStats.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">
                          データなし
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===== ログタブ ===== */}
        {tab === "logs" && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-700">🕐 直近48時間のページビュー</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {recentLogs.length}件 ／ ページ遷移のみ（アクション除く）
                </p>
              </div>
              {recentLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  データがありません
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentLogs.map((log, i) => (
                    <div key={i} className="flex items-center px-4 py-2.5 gap-3">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap w-24 flex-shrink-0">
                        {formatJST(log.created_at)}
                      </span>
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {log.user_name}
                      </span>
                      <span className="text-[10px] text-gray-500 flex-shrink-0 whitespace-nowrap">
                        {PAGE_LABELS[log.page] || log.page}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
