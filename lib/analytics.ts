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

/** 何を見て参加したか */
export type PlanEventSource = "plan" | "shift";

export type PlanEventInput = {
  /** posted: 出した / joined: 乗った / moved: 日付かジムを変えた / deleted: 消した */
  kind: "posted" | "joined" | "moved" | "deleted";
  date: string;
  gymName: string;
  /** この行の主語。代理登録なら同行者の名前 */
  user: string;
  /** 実際に操作した人。user と違えば代理登録 */
  actor: string;
  timeSlot?: string | null;
  source?: PlanEventSource;
  /** moved のとき、移動前の日付とジム */
  prevDate?: string;
  prevGymName?: string;
};

/**
 * 予定と参加の証跡を plan_events に追記する。
 *
 * climbing_logs の「予定」行はユーザーに削除されるので、そこからは参加の履歴を
 * 再構成できない。効果測定の母数はこのテーブルで持つ。trackAction と同じく、
 * 計測の失敗はアプリの動作に影響させない。
 */
export async function recordPlanEvents(events: PlanEventInput[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const supabase = createClient();
    await supabase.from("plan_events").insert(
      events.map((e) => ({
        kind: e.kind,
        date: e.date,
        gym_name: e.gymName,
        user: e.user,
        actor: e.actor,
        time_slot: e.timeSlot ?? null,
        source: e.source ?? null,
        prev_date: e.prevDate ?? null,
        prev_gym_name: e.prevGymName ?? null,
      }))
    );
  } catch {
    // 計測失敗は無視する
  }
}
