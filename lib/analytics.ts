import { createClient } from "@/lib/supabase/client";

/**
 * ページビューと操作の記録。page_views テーブルへの唯一の書き込み経路。
 * action を省略するとページビューとして記録される。
 * 計測の失敗はアプリの動作に影響させないため、エラーは握りつぶす。
 */
export async function trackAction(
  userName: string,
  page: string,
  action?: string
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from("page_views")
      .insert({ user_name: userName, page, action: action ?? null });
  } catch {
    // 計測失敗は無視する
  }
}
