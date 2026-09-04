"use client";

import { useState, useMemo } from "react";
import type { ClimbingLog, User } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { getTodayJST, toJSTDateString } from "@/lib/utils";
import { X } from "lucide-react";

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type Session = { date: string; gymName: string };
type Edge = { user1: string; user2: string; count: number; sessions: Session[] };
type Period = "thisMonth" | "lastMonth" | "3months" | "6months" | "12months";

interface Props {
  logs: ClimbingLog[];
  plans: ClimbingLog[];
  users: User[];
  currentUser: string;
}

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const W = 420;
const H = 436;     // 下のノードラベルが y≈411、余白25px
const NODE_R = 28;
const CX = W / 2;  // 210
const CY = 210;    // 円の中心
const CIRCLE_R = 155;

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: "thisMonth", label: "今月" },
  { value: "lastMonth", label: "先月" },
  { value: "3months",   label: "3ヶ月" },
  { value: "6months",   label: "6ヶ月" },
  { value: "12months",  label: "1年" },
];

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function getPeriodRange(period: Period): { start: string; end: string } {
  const now = new Date();
  const toStr = toJSTDateString;
  const today = getTodayJST();
  switch (period) {
    case "thisMonth":  return { start: toStr(new Date(now.getFullYear(), now.getMonth(), 1)), end: today };
    case "lastMonth":  return { start: toStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: toStr(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "3months":    return { start: toStr(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end: today };
    case "6months":    return { start: toStr(new Date(now.getFullYear(), now.getMonth() - 5, 1)), end: today };
    case "12months":   return { start: toStr(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)), end: today };
  }
}

function formatPeriodLabel(period: Period): string {
  const { start, end } = getPeriodRange(period);
  const fmt = (s: string) => { const [, m, d] = s.split("-"); return `${parseInt(m)}/${parseInt(d)}`; };
  return `${fmt(start)} 〜 ${fmt(end)}`;
}

function fmtDate(s: string): string {
  const [, m, d] = s.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function daysAgo(dateStr: string): string {
  const jstToday = getTodayJST();
  const diff = Math.floor((new Date(jstToday).getTime() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7)  return `${diff}日前`;
  if (diff < 30) return `${Math.floor(diff / 7)}週間前`;
  return `${Math.floor(diff / 30)}ヶ月前`;
}

// ─── エッジ計算 ───────────────────────────────────────────────────────────────

function buildEdges(logs: ClimbingLog[]): Edge[] {
  const groups = new Map<string, string[]>();
  for (const log of logs) {
    const key = `${log.date}|${log.gym_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log.user);
  }
  const edgeMap = new Map<string, Edge>();
  for (const [key, users] of Array.from(groups.entries())) {
    const [date, gymName] = key.split("|");
    const unique = Array.from(new Set(users));
    if (unique.length < 2) continue;
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const sorted = [unique[i], unique[j]].sort();
        const u1 = sorted[0] as string;
        const u2 = sorted[1] as string;
        const ek = `${u1}|||${u2}`;
        if (!edgeMap.has(ek)) edgeMap.set(ek, { user1: u1, user2: u2, count: 0, sessions: [] });
        const e = edgeMap.get(ek)!;
        e.count += 1;
        e.sessions.push({ date, gymName });
      }
    }
  }
  return Array.from(edgeMap.values()).map((e) => ({
    ...e,
    sessions: e.sessions.sort((a, b) => b.date.localeCompare(a.date)),
  }));
}

// ─── メインコンポーネント ──────────────────────────────────────────────────────

export function GraphClient({ logs, plans, users, currentUser }: Props) {
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const filteredLogs = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    return logs.filter((l) => {
      const d = l.date.slice(0, 10);
      return d >= start && d <= end;
    });
  }, [logs, period]);

  const edges     = useMemo(() => buildEdges(filteredLogs), [filteredLogs]);
  const allEdges  = useMemo(() => buildEdges(logs), [logs]);

  const userMap = new Map(users.map((u) => [u.user_name, u]));

  const connectedUsers = new Set<string>();
  filteredLogs.forEach((l) => connectedUsers.add(l.user));
  const nodeIds = Array.from(connectedUsers).filter((id) => userMap.has(id));
  const n = nodeIds.length;

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const myIndex = nodeIds.indexOf(currentUser);
    nodeIds.forEach((id, i) => {
      // currentUser が真下（π/2）に来るよう角度をオフセット
      const angle = (2 * Math.PI * (i - myIndex)) / n + Math.PI / 2;
      pos[id] = { x: CX + CIRCLE_R * Math.cos(angle), y: CY + CIRCLE_R * Math.sin(angle) };
    });
    return pos;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, nodeIds.join(","), currentUser]);

  const maxCount = Math.max(...edges.map((e) => e.count), 1);

  const neighborSet = useMemo(() => {
    const s = new Set<string>();
    if (!selectedNode) return s;
    edges.forEach((e) => {
      if (e.user1 === selectedNode) s.add(e.user2);
      if (e.user2 === selectedNode) s.add(e.user1);
    });
    return s;
  }, [selectedNode, edges]);

  // 他ユーザー選択時のパートナー情報
  const partnerInfo = useMemo(() => {
    if (!selectedNode || selectedNode === currentUser) return null;
    const today = new Date().toISOString().slice(0, 10);

    const nextPlan = plans
      .filter((p) => p.user === selectedNode && p.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

    const allEdge = allEdges.find(
      (e) => (e.user1 === selectedNode && e.user2 === currentUser) ||
             (e.user2 === selectedNode && e.user1 === currentUser)
    ) ?? null;

    const lastTogether = allEdge?.sessions[0] ?? null;

    // その人個人のよく行くジム（過去12ヶ月）
    const gymCounts = new Map<string, number>();
    logs.filter((l) => l.user === selectedNode).forEach((l) =>
      gymCounts.set(l.gym_name, (gymCounts.get(l.gym_name) || 0) + 1)
    );
    const theirTopGym = Array.from(gymCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

    // 2人のよく行くジム（過去12ヶ月）
    const sharedGymCounts = new Map<string, number>();
    allEdge?.sessions.forEach((s) =>
      sharedGymCounts.set(s.gymName, (sharedGymCounts.get(s.gymName) || 0) + 1)
    );
    const topSharedGym = Array.from(sharedGymCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

    return { nextPlan, lastTogether, theirTopGym, topSharedGym };
  }, [selectedNode, currentUser, plans, allEdges, logs]);

  // 自分選択時のランキング
  const selfRanking = useMemo(() => {
    if (selectedNode !== currentUser) return [];
    return edges
      .filter((e) => e.user1 === currentUser || e.user2 === currentUser)
      .sort((a, b) => b.count - a.count);
  }, [selectedNode, currentUser, edges]);

  const periodLabel = PERIOD_LABELS.find((p) => p.value === period)?.label ?? "";

  return (
    <>
      <PageHeader title="つながり" subtitle={formatPeriodLabel(period)} />

      <div className="px-4 pt-3 pb-4 space-y-3 page-enter">
        {/* 期間セレクター */}
        <div className="flex gap-1.5">
          {PERIOD_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setPeriod(value); setSelectedNode(null); setSelectedEdge(null); }}
              className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${
                period === value ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {n === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-base font-medium">この期間のデータがありません</p>
            <p className="text-sm mt-1">期間を変えてみてください</p>
          </div>
        ) : (
          <>
            {/* SVGグラフ（自然な縦横比で最大幅表示・親のpx-4を打ち消して横幅最大化） */}
            <div
              className="-mx-4 px-1"
              style={{ touchAction: "pan-y" }}
              onClick={() => { if (!selectedEdge) setSelectedNode(null); }}
            >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }}
              overflow="visible"
            >
              {/* エッジ */}
              {edges.map((edge) => {
                const p1 = positions[edge.user1];
                const p2 = positions[edge.user2];
                if (!p1 || !p2) return null;

                const normalized = edge.count / maxCount;
                const isNodeSelected = selectedNode !== null;
                const isHighlighted = selectedNode === edge.user1 || selectedNode === edge.user2;
                const isEdgeSelected = selectedEdge?.user1 === edge.user1 && selectedEdge?.user2 === edge.user2;

                let sw: number, op: number, stroke: string;
                if (!isNodeSelected)    { sw = 0.8 + normalized * 4.5; op = 0.1 + normalized * 0.55; stroke = "#334155"; }
                else if (isHighlighted) { sw = 2 + normalized * 5;     op = 1;    stroke = isEdgeSelected ? "#f97316" : "#0ea5e9"; }
                else                    { sw = 0.5;                     op = 0.04; stroke = "#334155"; }

                const cpX = CX * 0.6 + (p1.x + p2.x) * 0.2;
                const cpY = CY * 0.6 + (p1.y + p2.y) * 0.2;
                // ベジェ曲線 t=0.5 の点: 0.25*p1 + 0.5*cp + 0.25*p2
                const bx = 0.25 * p1.x + 0.5 * cpX + 0.25 * p2.x;
                const by = 0.25 * p1.y + 0.5 * cpY + 0.25 * p2.y;

                return (
                  <g key={`${edge.user1}-${edge.user2}`}>
                    {/* エッジ線（クリック無効） */}
                    <path d={`M ${p1.x} ${p1.y} Q ${cpX} ${cpY} ${p2.x} ${p2.y}`}
                      fill="none" stroke={stroke} strokeWidth={sw} opacity={op} strokeLinecap="round" />
                    {/* 回数バッジ（ノード選択中のみ表示・タップでシート） */}
                    {isHighlighted && isNodeSelected && (
                      <g style={{ cursor: "pointer", pointerEvents: "auto" }}
                        onClick={(e) => { e.stopPropagation(); setSelectedEdge(edge); }}>
                        <circle cx={bx} cy={by} r={16} fill="white" stroke={isEdgeSelected ? "#f97316" : "#0ea5e9"} strokeWidth={1.5} />
                        <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700"
                          fill={isEdgeSelected ? "#f97316" : "#0369a1"}>{edge.count}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* ノード */}
              {nodeIds.map((id) => {
                const pos = positions[id];
                if (!pos) return null;
                const user = userMap.get(id);
                if (!user) return null;
                const isMe = id === currentUser;
                const isSelected = selectedNode === id;
                const isNeighbor = neighborSet.has(id);
                const isDimmed = selectedNode !== null && !isSelected && !isNeighbor;

                return (
                  <g key={id} style={{ cursor: "pointer", pointerEvents: "auto" }}
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(selectedNode === id ? null : id); }}>
                    {isSelected && <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="none" stroke="#0ea5e9" strokeWidth={2.5} />}
                    {isMe && !isSelected && <circle cx={pos.x} cy={pos.y} r={NODE_R + 5} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4 3" />}
                    <circle cx={pos.x} cy={pos.y} r={NODE_R} fill={user.color || "#94a3b8"} opacity={isDimmed ? 0.35 : 1} />
                    <text x={pos.x} y={pos.y - 1} textAnchor="middle" dominantBaseline="central"
                      fontSize={17} opacity={isDimmed ? 0.35 : 1}>{user.icon || "🧗"}</text>
                    <text x={pos.x} y={pos.y + NODE_R + 18} textAnchor="middle"
                      fontSize={11} fontWeight={isMe || isSelected ? "700" : "500"}
                      fill={isDimmed ? "#94a3b8" : isSelected ? "#0ea5e9" : "#1e293b"}>
                      {id}
                    </text>
                  </g>
                );
              })}

            </svg>
          </div>

            {/* ヒントテキスト */}
            <p className="text-center text-xs text-gray-400 py-1">
              {!selectedNode ? "ユーザーをタップ" : "数字をタップでセッション詳細を確認"}
            </p>

            {/* 情報パネル */}
            <div>

            {/* 他ユーザー選択時 */}
            {partnerInfo && selectedNode && selectedNode !== currentUser && (() => {
              const u = userMap.get(selectedNode);
              return (
                <div className="bg-gray-50 rounded-2xl px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ backgroundColor: u?.color || "#94a3b8" }}>
                      {u?.icon || "🧗"}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500">{selectedNode} の情報</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <MiniInfo
                      label="次の予定"
                      value={partnerInfo.nextPlan
                        ? `${fmtDate(partnerInfo.nextPlan.date)} ${partnerInfo.nextPlan.gym_name}`
                        : "予定なし"}
                      empty={!partnerInfo.nextPlan}
                    />
                    <MiniInfo
                      label="最後に一緒に登った"
                      value={partnerInfo.lastTogether
                        ? `${daysAgo(partnerInfo.lastTogether.date)} · ${partnerInfo.lastTogether.gymName}`
                        : "記録なし（1年以内）"}
                      empty={!partnerInfo.lastTogether}
                    />
                    <MiniInfo
                      label="よく行くジム"
                      value={partnerInfo.theirTopGym
                        ? `${partnerInfo.theirTopGym[0]}（${partnerInfo.theirTopGym[1]}回）`
                        : "記録なし"}
                      empty={!partnerInfo.theirTopGym}
                    />
                    <MiniInfo
                      label="よく一緒に行くジム"
                      value={partnerInfo.topSharedGym
                        ? `${partnerInfo.topSharedGym[0]}（${partnerInfo.topSharedGym[1]}回）`
                        : "記録なし"}
                      empty={!partnerInfo.topSharedGym}
                    />
                  </div>
                </div>
              );
            })()}

            {/* 自分選択時：一緒に登った人ランキング */}
            {selectedNode === currentUser && (
              <div className="bg-gray-50 rounded-2xl px-3 py-2.5">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">
                  {periodLabel}によく一緒に登った順
                </p>
                {selfRanking.length === 0 ? (
                  <p className="text-xs text-gray-400">この期間は記録がありません</p>
                ) : (
                  <div className="space-y-1.5">
                    {selfRanking.map((e, i) => {
                      const partnerId = e.user1 === currentUser ? e.user2 : e.user1;
                      const partner = userMap.get(partnerId);
                      return (
                        <div key={partnerId} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm">
                          <span className="text-[10px] text-gray-400 w-4 text-center flex-shrink-0">{i + 1}</span>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                            style={{ backgroundColor: partner?.color || "#94a3b8" }}>
                            {partner?.icon || "🧗"}
                          </div>
                          <span className="text-[11px] font-medium text-gray-700 flex-1">{partnerId}</span>
                          <span className="text-[11px] font-bold text-sky-500">{e.count}回</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        )}
      </div>

      {/* エッジ詳細シート */}
      {selectedEdge && (
        <EdgeSheet edge={selectedEdge} users={users} onClose={() => setSelectedEdge(null)} />
      )}
    </>
  );
}

// ─── 情報アイテム ──────────────────────────────────────────────────────────────

function MiniInfo({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return (
    <div>
      <p className="text-[9px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-[11px] font-semibold leading-snug ${empty ? "text-gray-300" : "text-gray-700"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── エッジ詳細シート ─────────────────────────────────────────────────────────

function EdgeSheet({ edge, users, onClose }: { edge: Edge; users: User[]; onClose: () => void }) {
  const userMap = new Map(users.map((u) => [u.user_name, u]));
  const u1 = userMap.get(edge.user1);
  const u2 = userMap.get(edge.user2);

  const byMonth = new Map<string, Session[]>();
  for (const s of edge.sessions) {
    const m = s.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(s);
  }
  const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "65vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 64px)" }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[u1, u2].map((u, i) => (
                <div key={i} className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 border-white shadow-sm"
                  style={{ backgroundColor: u?.color || "#94a3b8" }}>
                  {u?.icon || "🧗"}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{edge.user1} &amp; {edge.user2}</p>
              <p className="text-xs text-orange-500 font-medium mt-0.5">{edge.count}回一緒に登った</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {months.map(([month, sessions]) => {
            const [y, m] = month.split("-");
            return (
              <div key={month} className="mb-4">
                <p className="text-xs font-semibold text-gray-400 mb-1.5">{y}年{parseInt(m)}月</p>
                <div className="space-y-1.5">
                  {sessions.map((s) => (
                    <div key={`${s.date}|${s.gymName}`} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl">
                      <span className="text-sm font-semibold text-gray-700 w-10 flex-shrink-0">{fmtDate(s.date)}</span>
                      <span className="text-sm text-gray-600 truncate">{s.gymName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
