-- 参加の証跡を残す追記専用テーブル。
--
-- climbing_logs の「予定」行は登り終わると消される。実データでは 7 ヶ月で
-- 332 件の予定が作られ、残っていたのは未来日の 20 件だけだった。つまり
-- climbing_logs からは「誰が誰の募集に乗ったか」を後から再構成できない。
-- 起きたその場でここに書き、以後この行は消さない。
--
-- 過去分は page_views の plan_created / plan_joined から復元する（lib/impact.ts）。
-- このテーブルに行が入り始めた時刻より前だけ page_views を使い、以後はこちらを見る。

create table if not exists public.plan_events (
  id uuid primary key default gen_random_uuid(),
  -- posted: 予定を出した / joined: 他人の予定に乗った
  -- moved:  予定の日付かジムを変えた / deleted: 予定を消した
  kind text not null check (kind in ('posted', 'joined', 'moved', 'deleted')),
  -- 登る日
  date date not null,
  gym_name text not null,
  -- この行の主語。代理登録された同行者なら、その同行者の名前が入る
  "user" text not null,
  -- 実際に操作した人。"user" と違えば代理登録なので、参加とは別に数える
  actor text not null,
  time_slot text,
  -- joined のとき、何を見て乗ったか: 'plan'（予定カード）/ 'shift'（バイト中カード）
  source text check (source is null or source in ('plan', 'shift')),
  -- moved のとき、移動前の日付とジム。「ジム未定」で出した募集が後からジムを
  -- 決めると参加は新しいジム名で記録されるので、これが無いと募集と参加が繋がらない。
  -- 実データではこれが原因で、参加 146 件のうち 37 件が募集不明になっていた
  prev_date date,
  prev_gym_name text,
  created_at timestamptz not null default now()
);

create index if not exists plan_events_created_at_idx on public.plan_events (created_at);
create index if not exists plan_events_date_gym_idx on public.plan_events (date, gym_name);

alter table public.plan_events enable row level security;

-- このアプリは anon キーだけで動く。読み取りと追記のみ許可し、更新と削除は許さない。
drop policy if exists plan_events_read on public.plan_events;
create policy plan_events_read on public.plan_events for select using (true);

drop policy if exists plan_events_insert on public.plan_events;
create policy plan_events_insert on public.plan_events for insert with check (true);

-- 2026-10-30 以降に作ったテーブルは GRANT を明示しないと anon から触れない
grant select, insert on public.plan_events to anon, authenticated;
