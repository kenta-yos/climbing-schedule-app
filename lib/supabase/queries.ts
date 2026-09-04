import { createClient } from "./client";

export type User = {
  user_name: string;
  color: string;
  icon: string;
  created_at: string;
};

export type ClimbingLog = {
  id: string;
  date: string;
  gym_name: string;
  user: string;
  type: "予定" | "実績";
  time_slot: "昼" | "夕方" | "夜" | null;
  with_friends?: boolean | null;
  join_dinner?: boolean | null;
  is_comp?: boolean | null;
  created_at: string;
};

export type GymMaster = {
  gym_name: string;
  profile_url: string | null;
  area_tag: string;
  created_by: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
};

export type AreaMaster = {
  area_tag: string;
  major_area: "都内・神奈川" | "関東" | "関西" | "全国";
};

export type WorkShift = {
  id: string;
  user_name: string;
  gym_name: string;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  content: string;
  display_until: string;
  created_by: string;
  created_at: string;
};

// クライミングログ追加
export async function addClimbingLog(log: Omit<ClimbingLog, "id" | "created_at">): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("climbing_logs").insert(log);
  if (error) throw error;
}

// クライミングログ削除
export async function deleteClimbingLog(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("climbing_logs").delete().eq("id", id);
  if (error) throw error;
}

// クライミングログ更新（日付・ジム名・時間帯・友人フラグ）
export async function updateClimbingLog(
  id: string,
  updates: { date?: string; gym_name?: string; time_slot?: "昼" | "夕方" | "夜" | null; with_friends?: boolean; join_dinner?: boolean; is_comp?: boolean }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("climbing_logs").update(updates).eq("id", id);
  if (error) throw error;
}

// ジム追加
export async function addGym(gym: Omit<GymMaster, "created_at">): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("gym_master").insert(gym);
  if (error) throw error;
}

// アクセスログ追加
export async function addAccessLog(userName: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("access_logs").insert({ user_name: userName });
  if (error) throw error;
}

// 重複チェックの共通ルール：同一ユーザー・同日・同時間帯・同種別で 1 件まで。
// 同じ時間帯に複数のジムへは行けないため、ジム名は条件に含めない。

// 自分自身の重複チェック
// excludeId: 編集中のログ自身は衝突判定から除く
export async function checkDuplicateLog(
  user: string,
  date: string,
  timeSlot: string,
  type: "予定" | "実績",
  excludeId?: string
): Promise<boolean> {
  const supabase = createClient();
  let query = supabase
    .from("climbing_logs")
    .select("id")
    .eq("user", user)
    .eq("date", date)
    .eq("time_slot", timeSlot)
    .eq("type", type);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

// 仲間の重複チェック → 既にログを持っているユーザー名の配列を返す
// excludeIds: 一緒に移動させる予定のログ自身は衝突判定から除く
export async function getCompanionConflicts(
  companions: string[],
  date: string,
  type: "予定" | "実績",
  timeSlot: string,
  excludeIds: string[] = []
): Promise<string[]> {
  if (companions.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("climbing_logs")
    .select("id, user")
    .in("user", companions)
    .eq("date", date)
    .eq("type", type)
    .eq("time_slot", timeSlot);
  return (data || [])
    .filter((l: { id: string }) => !excludeIds.includes(l.id))
    .map((l: { user: string }) => l.user);
}

// 複数のログを一括更新
export async function updateClimbingLogsBulk(
  ids: string[],
  updates: { date?: string; gym_name?: string; time_slot?: "昼" | "夕方" | "夜" | null }
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("climbing_logs")
    .update(updates)
    .in("id", ids);
  if (error) throw error;
}
