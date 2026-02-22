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

export type SetSchedule = {
  id: string;
  gym_name: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
};

export type AccessLog = {
  id: string;
  user_name: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  content: string;
  display_until: string;
  created_by: string;
  created_at: string;
};


// ユーザー一覧取得
export async function getUsers(): Promise<User[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("user_name");
  if (error) throw error;
  return data || [];
}

// クライミングログ取得
export async function getClimbingLogs(): Promise<ClimbingLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("climbing_logs")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ジムマスター取得
export async function getGyms(): Promise<GymMaster[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gym_master")
    .select("*")
    .order("gym_name");
  if (error) throw error;
  return data || [];
}

// エリアマスター取得
export async function getAreas(): Promise<AreaMaster[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("area_master")
    .select("*")
    .order("area_tag");
  if (error) throw error;
  return data || [];
}

// セットスケジュール取得
export async function getSetSchedules(): Promise<SetSchedule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("set_schedules")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

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

// クライミングログ更新（日付・ジム名・時間帯）
export async function updateClimbingLog(
  id: string,
  updates: { date?: string; gym_name?: string; time_slot?: "昼" | "夕方" | "夜" | null }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("climbing_logs").update(updates).eq("id", id);
  if (error) throw error;
}

// ジムのlat/lng更新
export async function updateGymLocation(
  gymName: string,
  lat: number | null,
  lng: number | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("gym_master")
    .update({ lat, lng })
    .eq("gym_name", gymName);
  if (error) throw error;
}

// ジム追加
export async function addGym(gym: Omit<GymMaster, "created_at">): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("gym_master").insert(gym);
  if (error) throw error;
}

// セットスケジュール追加（バッチ）
export async function addSetSchedules(schedules: Omit<SetSchedule, "id" | "created_at">[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("set_schedules").insert(schedules);
  if (error) throw error;
}

// 1年以上前のセットスケジュールを削除
export async function deleteOldSetSchedules(): Promise<void> {
  const supabase = createClient();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const { error } = await supabase
    .from("set_schedules")
    .delete()
    .lt("start_date", cutoff);
  if (error) throw error;
}

// アクセスログ追加
export async function addAccessLog(userName: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("access_logs").insert({ user_name: userName });
  if (error) throw error;
}

// ページビュー記録（fire-and-forget、エラーは無視）
export async function addPageView(userName: string, page: string, action?: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("page_views").insert({ user_name: userName, page, action: action ?? null });
}

// 同グループ（同日・同ジム・同時間帯）の他ユーザーのログを取得
export async function getGroupLogs(
  date: string,
  gymName: string,
  timeSlot: string,
  excludeUser: string
): Promise<ClimbingLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("climbing_logs")
    .select("*")
    .eq("date", date)
    .eq("gym_name", gymName)
    .eq("time_slot", timeSlot)
    .eq("type", "予定")
    .neq("user", excludeUser);
  if (error) throw error;
  return data || [];
}

// 特定ユーザーの変更後日付・ジム・時間帯に既存の予定があるか確認（重複チェック）
export async function getConflictingLog(
  user: string,
  date: string,
  gymName: string,
  timeSlot: string,
  excludeId: string
): Promise<ClimbingLog | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("climbing_logs")
    .select("*")
    .eq("user", user)
    .eq("date", date)
    .eq("gym_name", gymName)
    .eq("time_slot", timeSlot)
    .eq("type", "予定")
    .neq("id", excludeId)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// 自分自身の重複チェック（同日・同時間帯・同種別）
export async function checkDuplicateLog(
  user: string,
  date: string,
  timeSlot: string,
  type: "予定" | "実績"
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("climbing_logs")
    .select("id")
    .eq("user", user)
    .eq("date", date)
    .eq("time_slot", timeSlot)
    .eq("type", type)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// 仲間の重複チェック（同日・同ジム・同種別・同時間帯）→ 既に持っているユーザー名の配列を返す
export async function getCompanionConflicts(
  companions: string[],
  date: string,
  gymName: string,
  type: "予定" | "実績",
  timeSlot: string
): Promise<string[]> {
  if (companions.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("climbing_logs")
    .select("user")
    .in("user", companions)
    .eq("date", date)
    .eq("gym_name", gymName)
    .eq("type", type)
    .eq("time_slot", timeSlot);
  return (data || []).map((l: { user: string }) => l.user);
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
