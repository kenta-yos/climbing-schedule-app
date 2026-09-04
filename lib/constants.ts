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

// バイトシフトを登録できるユーザー（users.id）とその勤務先。
// 名前で判定すると改名で機能が消えるため、id で判定する。
export const SHIFT_USER_ID = "fd386100-bb1e-4532-9ca5-5bdc20b68217";
export const SHIFT_GYM = "THE STONE SESSION TOKYO";
