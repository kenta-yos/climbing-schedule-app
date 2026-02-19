import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "Asia/Tokyo";

// 日本時間で現在日時を取得
export function getNowJST(): Date {
  return toZonedTime(new Date(), TZ);
}

// 日本時間でフォーマット
export function formatJST(date: Date | string, fmt: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return tzFormat(toZonedTime(d, TZ), fmt, { timeZone: TZ });
}

// 今日の日本日付文字列 (YYYY-MM-DD)
export function getTodayJST(): string {
  return formatJST(new Date(), "yyyy-MM-dd");
}

// 今月の開始/終了 (日本時間)
export function getCurrentMonthRange(): { start: string; end: string } {
  const now = getNowJST();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: tzFormat(toZonedTime(start, TZ), "yyyy-MM-dd", { timeZone: TZ }),
    end: tzFormat(toZonedTime(end, TZ), "yyyy-MM-dd", { timeZone: TZ }),
  };
}

// 日付をMM/DD形式に変換
export function formatMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return tzFormat(toZonedTime(d, TZ), "M/d", { timeZone: TZ });
}

// 日付をYYYY年M月D日形式に変換
export function formatJapaneseDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return tzFormat(toZonedTime(d, TZ), "yyyy年M月d日", { timeZone: TZ });
}

// 月選択用のリスト生成 (過去6ヶ月〜翌月)
export function getMonthOptions(): { value: string; label: string }[] {
  const now = getNowJST();
  const options = [];
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = tzFormat(toZonedTime(d, TZ), "yyyy-MM", { timeZone: TZ });
    const label = tzFormat(toZonedTime(d, TZ), "yyyy年M月", { timeZone: TZ });
    options.push({ value, label });
  }
  return options.reverse();
}

// 日数差計算
export function daysDiff(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}
