export const TIME_SLOTS = [
  { value: "昼", label: "昼", icon: "/images/hiru.png" },
  { value: "夕方", label: "夕方", icon: "/images/yuu.png" },
  { value: "夜", label: "夜", icon: "/images/yoru.png" },
] as const;

export type TimeSlot = "昼" | "夕方" | "夜";

export const MAJOR_AREA_ORDER = ["都内・神奈川", "関東", "関西", "全国"] as const;
export type MajorArea = (typeof MAJOR_AREA_ORDER)[number];

export const CLIMBING_GRADIENT = "linear-gradient(135deg, #FF512F, #DD2476)";

// ランキングメダル
export const RANK_MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

// スコアリング定数
export const SCORING = {
  FRESH_DAYS: 7,
  SEMI_FRESH_DAYS: 14,
  FRESH_SCORE: 40,
  SEMI_FRESH_SCORE: 30,
  FRIENDS_SCORE: 15,
  UNVISITED_SCORE: 10,
  OVERDUE_DAYS: 30,
  OVERDUE_SCORE: 20,
} as const;

// フィードの表示日数
export const FUTURE_DAYS = 21;
export const FRIENDS_DAYS = 30;
