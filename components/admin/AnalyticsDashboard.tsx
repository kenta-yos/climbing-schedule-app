"use client";

import { useState } from "react";

export type AnalyticsProps = {
  summary: {
    totalLogins: number;
    totalPageViews: number;
    uniqueUsers30d: number;
    uniqueUsers7d: number;
  };
  dailyLogins: { date: string; count: number }[];
  dailyPageViews: { date: string; count: number }[];
  pageViewCounts: { page: string; count: number }[];
  actionCounts: { action: string; count: number }[];
  userStats: { user: string; logins: number; pageViews: number; actions: number }[];
};

type Tab = "overview" | "actions" | "users";

// シンプルな棒グラフ
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

// 水平バーチャート（ページ/アクション用）
function HBarChart({ items, color = "bg-orange-400" }: { items: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-40 flex-shrink-0 truncate">{label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`${color} h-full rounded-full transition-all`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6 text-right flex-shrink-0">{count}</span>
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
    ["plan_created", "log_created", "plan_updated", "plan_deleted",
     "gym_selected_search", "gym_selected_recent", "gym_selected_undecided"].includes(a.action)
  );
  const gyms = actionCounts.filter((a) =>
    ["sort_distance", "sort_freshset", "sort_overdue",
     "gps_auto", "gps_button", "address_set",
     "nationwide_on", "nationwide_off", "load_more"].includes(a.action)
  );
  const other = actionCounts.filter(
    (a) => ![...home, ...plan, ...gyms].find((x) => x.action === a.action)
  );
  return { home, plan, gyms, other };
}

// アクション日本語ラベル
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
  admin: "⚙️ 管理",
};

export function AnalyticsDashboard({
  summary,
  dailyLogins,
  dailyPageViews,
  pageViewCounts,
  actionCounts,
  userStats,
}: AnalyticsProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const { home, plan, gyms, other } = categorizeActions(actionCounts);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gray-900 text-white px-4 py-3 flex items-center gap-2"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <span className="text-sm font-bold flex-1">📈 Analytics</span>
        <span className="text-xs text-gray-400">過去30日</span>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[calc(44px+env(safe-area-inset-top))] z-10">
        {(["overview", "actions", "users"] as Tab[]).map((t) => {
          const label = t === "overview" ? "概要" : t === "actions" ? "アクション" : "ユーザー";
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                tab === t
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ===== 概要タブ ===== */}
        {tab === "overview" && (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">ログイン数（30日）</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalLogins}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">ページビュー（30日）</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalPageViews}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">アクティブユーザー（30日）</p>
                <p className="text-2xl font-bold text-orange-500">{summary.uniqueUsers30d}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">アクティブユーザー（7日）</p>
                <p className="text-2xl font-bold text-orange-500">{summary.uniqueUsers7d}</p>
              </div>
            </div>

            {/* 日別ログイン数 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">📅 日別ログイン数（14日）</p>
              <BarChart data={dailyLogins} />
            </div>

            {/* 日別ページビュー */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">📊 日別ページビュー（14日）</p>
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
            {/* ホームのエンゲージメント */}
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

            {/* 記録・予定 */}
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

                {/* ジム選択方法の比率 */}
                {(() => {
                  const search = plan.find((a) => a.action === "gym_selected_search")?.count || 0;
                  const recent = plan.find((a) => a.action === "gym_selected_recent")?.count || 0;
                  const undecided = plan.find((a) => a.action === "gym_selected_undecided")?.count || 0;
                  const total = search + recent + undecided;
                  if (total === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-[10px] text-gray-400 mb-2">ジム選択方法の内訳</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-green-500">{Math.round(search / total * 100)}%</span>
                          <span className="text-gray-400">検索</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-orange-500">{Math.round(recent / total * 100)}%</span>
                          <span className="text-gray-400">よく行く</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-gray-400">{Math.round(undecided / total * 100)}%</span>
                          <span className="text-gray-400">未定</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ジム一覧 */}
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

                {/* GPS利用率 */}
                {(() => {
                  const gpsAuto = gyms.find((a) => a.action === "gps_auto")?.count || 0;
                  const gpsBtn = gyms.find((a) => a.action === "gps_button")?.count || 0;
                  const addr = gyms.find((a) => a.action === "address_set")?.count || 0;
                  const total = gpsAuto + gpsBtn + addr;
                  if (total === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-[10px] text-gray-400 mb-2">出発地の設定方法</p>
                      <div className="flex gap-2 text-xs">
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-blue-500">{Math.round(gpsAuto / total * 100)}%</span>
                          <span className="text-gray-400">GPS自動</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-purple-500">{Math.round(gpsBtn / total * 100)}%</span>
                          <span className="text-gray-400">GPSボタン</span>
                        </span>
                        <span className="flex-1 text-center">
                          <span className="block text-base font-bold text-gray-400">{Math.round(addr / total * 100)}%</span>
                          <span className="text-gray-400">住所入力</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* その他 */}
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-700">👤 ユーザー別アクティビティ（30日）</p>
              </div>
              <div className="divide-y divide-gray-50">
                {/* ヘッダー行 */}
                <div className="flex items-center px-4 py-2 bg-gray-50">
                  <span className="text-[10px] font-semibold text-gray-400 flex-1">ユーザー</span>
                  <span className="text-[10px] font-semibold text-gray-400 w-12 text-right">ログイン</span>
                  <span className="text-[10px] font-semibold text-gray-400 w-12 text-right">PV</span>
                  <span className="text-[10px] font-semibold text-gray-400 w-14 text-right">アクション</span>
                </div>
                {userStats.map(({ user, logins, pageViews: pv, actions }) => (
                  <div key={user} className="flex items-center px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-800 flex-1 truncate">{user}</span>
                    <span className="text-xs font-bold text-orange-500 w-12 text-right">{logins}</span>
                    <span className="text-xs text-gray-600 w-12 text-right">{pv}</span>
                    <span className="text-xs text-gray-600 w-14 text-right">{actions}</span>
                  </div>
                ))}
                {userStats.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">データなし</div>
                )}
              </div>
            </div>

            {/* エンゲージメント率（参加ボタン→確定） */}
            {(() => {
              const joinTapped = actionCounts.find((a) => a.action === "join_tapped")?.count || 0;
              const planJoined = actionCounts.find((a) => a.action === "plan_joined")?.count || 0;
              const recordTapped = actionCounts.find((a) => a.action === "record_tapped")?.count || 0;
              const planCreated = actionCounts.find((a) => a.action === "plan_created")?.count || 0;
              const logCreated = actionCounts.find((a) => a.action === "log_created")?.count || 0;
              return (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-3">🔄 コンバージョン</p>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">参加ボタン → 参加確定</span>
                        <span className="font-bold text-gray-700">
                          {joinTapped > 0 ? `${Math.round(planJoined / joinTapped * 100)}%` : "—"}
                          <span className="text-gray-400 font-normal ml-1">({planJoined}/{joinTapped})</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-orange-400 h-full rounded-full"
                          style={{ width: joinTapped > 0 ? `${planJoined / joinTapped * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">記録ボタン → 予定/実績登録</span>
                        <span className="font-bold text-gray-700">
                          {recordTapped > 0 ? `${Math.round((planCreated + logCreated) / recordTapped * 100)}%` : "—"}
                          <span className="text-gray-400 font-normal ml-1">({planCreated + logCreated}/{recordTapped})</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-400 h-full rounded-full"
                          style={{ width: recordTapped > 0 ? `${(planCreated + logCreated) / recordTapped * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
