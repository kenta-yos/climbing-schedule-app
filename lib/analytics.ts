import { createClient } from "@/lib/supabase/client";

/**
 * クライアントコンポーネント用のアクション記録（fire-and-forget）
 */
export function trackAction(userName: string, page: string, action: string): void {
  const supabase = createClient();
  supabase
    .from("page_views")
    .insert({ user_name: userName, page, action })
    .then(() => {});
}
