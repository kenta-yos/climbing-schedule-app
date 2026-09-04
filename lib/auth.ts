import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_USER_ID } from "@/lib/constants";

/**
 * Cookie からログイン中のユーザー名を取得する。未ログインなら null。
 */
export function getCurrentUser(): string | null {
  const raw = cookies().get("user_name")?.value;
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * ログイン必須のページで使う。未ログインならログイン画面へ飛ばす。
 */
export function requireUser(): string {
  const user = getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/**
 * 管理者かどうかを判定する。users テーブルの ADMIN_USER_ID の行と名前を突き合わせる。
 */
export async function isAdminUser(userName: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("user_name")
    .eq("id", ADMIN_USER_ID)
    .single();
  return !!data && data.user_name === userName;
}
