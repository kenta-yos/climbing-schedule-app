export const TIME_SLOTS = [
  { value: "昼", label: "昼", icon: "/images/hiru.png" },
  { value: "夕方", label: "夕方", icon: "/images/yuu.png" },
  { value: "夜", label: "夜", icon: "/images/yoru.png" },
] as const;

// ランキングメダル
export const RANK_MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

// 管理者ユーザー（users.id）。お知らせ・ユーザー管理・分析ダッシュボードの権限判定に使う
export const ADMIN_USER_ID = "8779bd4c-be62-49af-9a74-2fa035079ca9";
