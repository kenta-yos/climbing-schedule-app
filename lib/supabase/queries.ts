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
  post_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type AccessLog = {
  id: string;
  user_name: string;
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

// アクセスログ追加
export async function addAccessLog(userName: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("access_logs").insert({ user_name: userName });
  if (error) throw error;
}
