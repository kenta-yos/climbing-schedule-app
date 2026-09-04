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

// Date を日本時間の YYYY-MM-DD 文字列に変換
export function toJSTDateString(date: Date): string {
  return formatJST(date, "yyyy-MM-dd");
}

// 今日の日本日付文字列 (YYYY-MM-DD)
export function getTodayJST(): string {
  return toJSTDateString(new Date());
}

// N日後の日本日付文字列 (YYYY-MM-DD)  ※負数で過去
// 現在時刻（絶対時刻）に日数を加算してから日本時間の日付を読む。
// getNowJST() の戻り値に加算すると、タイムゾーン変換が二重にかかり
// JST 15時以降で1日ずれるため、ここでは使わない。
export function getDateOffsetJST(offsetDays: number): string {
  return toJSTDateString(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

// 明日の日本日付文字列 (YYYY-MM-DD)
export function getTomorrowJST(): string {
  return getDateOffsetJST(1);
}

// 日付をMM/DD形式に変換
export function formatMMDD(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return tzFormat(toZonedTime(d, TZ), "M/d", { timeZone: TZ });
}

// 日数差計算
export function daysDiff(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

// Haversine公式で2点間の直線距離(km)を計算
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.asin(Math.sqrt(a));
}
