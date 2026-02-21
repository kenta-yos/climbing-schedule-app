"use server";

import { revalidatePath } from "next/cache";

/**
 * ホーム画面・プラン画面のキャッシュを無効化する。
 * router.refresh() はクライアントサイドルーターキャッシュのみ更新し、
 * Next.js の RSC ペイロードキャッシュが残存するケースがあるため、
 * こちらを使って確実に両ページを再検証する。
 */
export async function revalidateSchedulePages() {
  revalidatePath("/home", "page");
  revalidatePath("/home/plan", "page");
}
