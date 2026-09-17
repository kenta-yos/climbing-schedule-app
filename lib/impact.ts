/**
 * アプリの効果測定。
 *
 * ## なぜ climbing_logs から数えないのか
 *
 * 以前はここで climbing_logs の「予定」行を並べ、日付×ジムの組で最初の行を募集、
 * あとから来た別人の行を参加、とみなしていた。これは成立しない。予定は登り終わると
 * ユーザーに削除されるからで、実データでは 7 ヶ月で 332 件作られた予定のうち、
 * 残っていたのは未来日の 20 件だけだった。生きている予定が全部未来日である以上、
 * 「参加した人が実際に登ったか」は構造的に必ず 0 件になる。
 *
 * ## どこから数えるか
 *
 * 起きたその場で記録したイベントだけを使う。出どころは 2 つ。
 *
 * - `plan_events`（追記専用・削除しない）… 今後の本命
 * - `page_views` の action（`plan_created` / `plan_joined`）… 過去分の復元用
 *
 * plan_events に行が入り始めた時刻を境に切り替える。それより前は page_views、
 * 以後は plan_events。同じ操作を二重に数えないための境目。
 *
 * 実績（来訪）だけは climbing_logs を見る。実績行は削除されずに残っているため。
 *
 * ## 代理登録の扱い
 *
 * 予定入力画面で「一緒に登る人」を選ぶと、仲間の分の行も本人が作る。これは参加では
 * ないので分けて数える。plan_events は `user`（その行の主語）と `actor`（操作した人）を
 * 別に持つので判別できる。以前の「2 分以内に連続作成されたものは代理登録」という
 * 推定は不要になった。実データではこの推定が、編集で後から追加された同行者を
 * 参加として数え、2 件の参加のうち 1 件が偽陽性になっていた。
 */

import { GYM_UNDECIDED_LABEL, GROUP_ROLLOUT_DATE } from "./constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375;

/** climbing_logs の行。実績（来訪）の突き合わせにだけ使う */
export type ImpactLog = {
  date: string;
  gym_name: string;
  user: string;
  type: string;
  created_at: string | null;
};

/** plan_events の行 */
export type PlanEventRow = {
  kind: string;
  date: string;
  gym_name: string;
  user: string;
  actor: string;
  source: string | null;
  prev_date: string | null;
  prev_gym_name: string | null;
  created_at: string;
};

/** page_views の action 行 */
export type ActionRow = {
  user_name: string;
  action: string;
  created_at: string;
};

/** 2 つの出どころを揃えた、参加まわりの出来事 */
type Event = {
  kind: "posted" | "joined" | "moved" | "deleted";
  /** 登る日 YYYY-MM-DD */
  date: string;
  gym: string;
  /** この出来事の主語 */
  user: string;
  /** 実際に操作した人。user と違えば代理登録 */
  actor: string;
  /** 参加のとき、何を見て乗ったか */
  source: "plan" | "shift" | null;
  /** 記録された時刻（ミリ秒） */
  at: number;
  /** moved のとき、移動前の日付×ジムのキー */
  from: string | null;
};

export type ImpactResult = {
  label: string;
  /** 集計対象の月数。1 人あたり月次の指標を出すのに使う */
  months: number;
  /** 実際の集計開始日。GROUP_ROLLOUT_DATE より前は遡らない */
  since: string;
  /** 指定された期間が展開日より前まで遡っていて、開始日を丸めたか */
  clampedToRollout: boolean;
  /** この期間の集計が page_views 復元分を含むか */
  usesRestoredEvents: boolean;

  // --- 募集と参加。すべて実測 ---
  /** 募集の数。日付×ジムごとに、自分で出した最初の予定を 1 件と数える */
  posts: number;
  /** そのうち 1 件以上の参加がついたもの */
  postsWithJoin: number;
  /** postsWithJoin / posts */
  joinRate: number;
  /** 上の募集に付いた参加の延べ件数。期間外に起きた参加も、その募集の実績として数える */
  joinsOnPosts: number;
  /** 期間内に起きた参加の件数。募集がいつ出されたかは問わない */
  joinsInPeriod: number;
  /** そのうち、対応する募集が見つからないもの。計測より前に出た予定への参加など */
  orphanJoins: number;
  /** 募集主が自分の募集に乗った記録。本人の来訪なので、どの参加の数にも入れない */
  selfJoins: number;
  /** バイト中カードから乗った参加 */
  shiftJoins: number;
  /** 代理登録された同行者の件数。参加とは別勘定 */
  proxyPosts: number;
  /** 削除された予定の件数 */
  deletedPosts: number;
  /** 最初の参加までの時間の中央値 */
  medianHoursToFirstJoin: number | null;
  /** ジム未定（仲間募集）の予定だけを見た場合 */
  undecided: { posts: number; postsWithJoin: number; joinRate: number };
  /** ジムを決めて出した予定だけを見た場合 */
  fixedGym: { posts: number; postsWithJoin: number; joinRate: number };

  // --- 参加が来訪に届いたか ---
  /** 期間内に起きた参加のうち、日付が過ぎていて実績の有無を判定できるもの */
  pastJoins: number;
  /** そのうち climbing_logs に実績が残っていたもの */
  joinsWithVisit: number;
  /** 期間内に 1 回以上参加した実人数 */
  joiners: number;
  /** そのうち、実際に登った記録まで残した実人数 */
  visitingJoiners: number;
  /** joinsWithVisit / pastJoins */
  visitRate: number;
  /** 期間内の実績の総数 */
  totalVisits: number;
  /** 期間内に 1 件以上ログがあるユーザー数（＝実効ユーザー数） */
  activeUsers: number;
  /** 実効ユーザー 1 人あたり月あたりの来訪数 */
  visitsPerUserPerMonth: number;
  /** 同じく、参加をきっかけに生まれた来訪数 */
  joinVisitsPerUserPerMonth: number;
  /** 参加由来の来訪が全来訪に占める割合 */
  joinVisitShare: number;
};

const toDate = (value: string) => value.slice(0, 10);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function normalizePlanEvents(rows: PlanEventRow[]): Event[] {
  const events: Event[] = [];
  for (const row of rows) {
    if (row.kind !== "posted" && row.kind !== "joined" && row.kind !== "moved" && row.kind !== "deleted")
      continue;
    events.push({
      kind: row.kind,
      date: toDate(row.date),
      gym: row.gym_name,
      user: row.user,
      actor: row.actor,
      source: row.source === "plan" || row.source === "shift" ? row.source : null,
      at: new Date(row.created_at).getTime(),
      from:
        row.kind === "moved" && row.prev_date && row.prev_gym_name
          ? `${toDate(row.prev_date)}|${row.prev_gym_name}`
          : null,
    });
  }
  return events;
}

/**
 * page_views の action から、plan_events と同じ形の出来事を復元する。
 *
 * `plan_created|日付|ジム|同行者,同行者` … 予定の作成。同行者は代理登録
 * `plan_joined|日付|ジム|参加元`         … 参加。参加元は途中から付いた項目
 *
 * 「友人」はアプリ外の知人を指す予約語で、ユーザーではないので同行者から外す。
 */
function normalizeActions(rows: ActionRow[]): Event[] {
  const events: Event[] = [];
  for (const row of rows) {
    const [base, rawDate, gym, extra] = row.action.split("|");
    if (!rawDate || !gym) continue;
    const date = toDate(rawDate);
    const at = new Date(row.created_at).getTime();

    if (base === "plan_created") {
      events.push({ kind: "posted", date, gym, user: row.user_name, actor: row.user_name, source: null, at, from: null });
      for (const companion of (extra || "").split(",")) {
        const name = companion.trim();
        if (!name || name === "友人") continue;
        events.push({ kind: "posted", date, gym, user: name, actor: row.user_name, source: null, at, from: null });
      }
    } else if (base === "plan_joined") {
      events.push({
        kind: "joined",
        date,
        gym,
        user: row.user_name,
        actor: row.user_name,
        source: extra === "plan" || extra === "shift" ? extra : null,
        at,
        from: null,
      });
    } else if (base === "plan_deleted") {
      events.push({ kind: "deleted", date, gym, user: row.user_name, actor: row.user_name, source: null, at, from: null });
    }
  }
  return events;
}

/**
 * 2 つの出どころを、重複なく 1 本の列につなぐ。
 * plan_events が始まった時刻より前だけ page_views の復元分を使う。
 */
export function mergeEventSources(
  planEvents: PlanEventRow[],
  actions: ActionRow[]
): { events: Event[]; cutover: number | null } {
  const fromTable = normalizePlanEvents(planEvents);
  const cutover = fromTable.length > 0 ? Math.min(...fromTable.map((e) => e.at)) : null;
  const restored = normalizeActions(actions).filter((e) => cutover === null || e.at < cutover);
  return { events: [...fromTable, ...restored], cutover };
}

/**
 * 期間内の出来事から効果指標を組み立てる。
 *
 * 募集と参加は「記録された時刻」で期間を切る。募集に付いた参加は、期間外に
 * 起きたものも当該募集の実績として数える（募集を主語にした率にするため）。
 * 来訪は climbing_logs の実績を「登った日」で切る。
 *
 * sinceDate を省略すると全期間を対象にする。日付は YYYY-MM-DD。
 */
export function analyzeImpact(
  events: Event[],
  visitLogs: ImpactLog[],
  { label, sinceDate, cutover, today }: { label: string; sinceDate?: string; cutover?: number | null; today: string }
): ImpactResult {
  // Kenta 1 人で使っていた期間は、比較対象にならないうえ 1 人あたりの指標を
  // 歪めるので、どの期間指定でも展開日より前には遡らない
  const requested = sinceDate ?? GROUP_ROLLOUT_DATE;
  const clampedToRollout = requested < GROUP_ROLLOUT_DATE;
  const startDate = clampedToRollout ? GROUP_ROLLOUT_DATE : requested;
  const since = new Date(`${startDate}T00:00:00+09:00`).getTime();
  const inPeriod = (at: number) => at >= since;

  const posts = events.filter((e) => e.kind === "posted" && e.user === e.actor);
  const proxies = events.filter((e) => e.kind === "posted" && e.user !== e.actor);
  const allJoins = events.filter((e) => e.kind === "joined");

  // 「ジム未定」で出した募集が後からジムを決めると、参加は新しいジム名で記録される。
  // 移動の記録をたどって、募集も参加も最終的なキーに揃える
  const movedTo = new Map<string, string>();
  for (const move of events) {
    if (move.kind === "moved" && move.from) movedTo.set(move.from, `${move.date}|${move.gym}`);
  }
  const resolve = (key: string): string => {
    let current = key;
    for (let hop = 0; hop < 8; hop++) {
      const next = movedTo.get(current);
      if (!next || next === current) break;
      current = next;
    }
    return current;
  };

  // 募集＝日付×ジムごとに最初の 1 件。同じ人が出し直しても 1 件に畳む
  const seedByKey = new Map<string, Event>();
  for (const post of posts) {
    const key = resolve(`${post.date}|${post.gym}`);
    const current = seedByKey.get(key);
    if (!current || post.at < current.at) seedByKey.set(key, post);
  }

  // 移動の記録が無い過去分（page_views からの復元）向けの救済。
  // その日に募集がただ 1 つしか無ければ、ジム名が違っても同じ募集とみなす。
  // 複数あると取り違えるので、その場合は諦めて募集不明のまま残す
  const soleKeyByDate = new Map<string, string | null>();
  for (const key of Array.from(seedByKey.keys())) {
    const date = key.slice(0, key.indexOf("|"));
    soleKeyByDate.set(date, soleKeyByDate.has(date) ? null : key);
  }
  const keyForJoin = (join: Event): string | null => {
    const exact = resolve(`${join.date}|${join.gym}`);
    if (seedByKey.has(exact)) return exact;
    return soleKeyByDate.get(join.date) ?? null;
  };

  // 参加を募集に紐づける。募集がいつ出されたかで切らないのは、期間の頭で
  // 切り落とすと「参加はしているのに募集が期間外」という行き場のない件数が
  // 大量に出て、短い窓ほど率が不当に低く見えるため。
  // 募集を出した本人が出し直した行は参加ではない。
  const joinsByKey = new Map<string, Event[]>();
  const matchedJoins = new Set<Event>();
  // 募集主が自分の募集に乗った記録。本人の来訪であって参加ではないので、
  // どの数にも入れずに件数だけ持っておく
  const selfJoinSet = new Set<Event>();
  for (const join of allJoins) {
    const key = keyForJoin(join);
    const seed = key === null ? undefined : seedByKey.get(key);
    if (!key || !seed) continue;
    if (join.user === seed.user) {
      selfJoinSet.add(join);
      continue;
    }
    matchedJoins.add(join);
    const list = joinsByKey.get(key);
    if (list) list.push(join);
    else joinsByKey.set(key, [join]);
  }

  // 参加率は「この期間に出された募集」を主語にする。その募集に後から付いた参加は
  // 期間外に起きたものも数える（募集を出した側から見た率にするため）
  const seeds = Array.from(seedByKey.entries()).filter(([, seed]) => inPeriod(seed.at));

  const undecided = { posts: 0, postsWithJoin: 0 };
  const fixedGym = { posts: 0, postsWithJoin: 0 };
  const hoursToFirstJoin: number[] = [];
  let postsWithJoin = 0;
  let joinsOnPosts = 0;

  for (const [key, seed] of seeds) {
    const bucket = seed.gym === GYM_UNDECIDED_LABEL ? undecided : fixedGym;
    bucket.posts++;
    const group = joinsByKey.get(key);
    if (!group || group.length === 0) continue;
    postsWithJoin++;
    bucket.postsWithJoin++;
    joinsOnPosts += group.length;
    hoursToFirstJoin.push(Math.min(...group.map((j) => (j.at - seed.at) / MS_PER_HOUR)));
  }

  // 来訪の判定は「この期間に起きた参加」が主語。募集が特定できなかった参加も、
  // 参加ボタンを押して実際に行っている点は変わらないので母数に含める。
  // 上の参加率（募集が主語）とはここで数え方が分かれる
  // 募集主本人の分はここで落とす。残りは、募集が特定できた参加と、
  // 募集が見つからなかった参加（計測より前に出た予定への参加など）
  const periodJoins = allJoins.filter((j) => inPeriod(j.at) && !selfJoinSet.has(j));
  const orphanJoins = periodJoins.filter((j) => !matchedJoins.has(j)).length;
  const selfJoins = allJoins.filter((j) => inPeriod(j.at) && selfJoinSet.has(j)).length;

  // --- 参加が来訪まで届いたか ---
  // 実績行は削除されずに残るので、参加者・登った日の一致で引ける。
  // まだ来ていない日付は判定できないので母数から外す。
  const visitKeys = new Set(
    visitLogs.filter((l) => l.type === "実績").map((l) => `${l.user}|${toDate(l.date)}`)
  );
  const pastJoinList = periodJoins.filter((j) => j.date < today);
  const visitedJoins = pastJoinList.filter((j) => visitKeys.has(`${j.user}|${j.date}`));
  const joinsWithVisit = visitedJoins.length;

  // --- 来訪の総量 ---
  const visitsInPeriod = visitLogs.filter((l) => l.type === "実績" && toDate(l.date) >= startDate);
  const periodDays = Math.max((Date.now() - since) / MS_PER_DAY, 1);
  const months = periodDays / DAYS_PER_MONTH;

  const activeUsers = new Set(visitsInPeriod.map((l) => l.user)).size;
  const perUserMonth = (value: number) =>
    activeUsers === 0 || months === 0 ? 0 : value / activeUsers / months;

  return {
    label,
    months,
    since: startDate,
    clampedToRollout,
    usesRestoredEvents: cutover === null || cutover === undefined || since < cutover,
    posts: seeds.length,
    postsWithJoin,
    joinRate: rate(postsWithJoin, seeds.length),
    joinsOnPosts,
    joinsInPeriod: periodJoins.length - orphanJoins,
    orphanJoins,
    selfJoins,
    shiftJoins: periodJoins.filter((j) => j.source === "shift").length,
    proxyPosts: proxies.filter((e) => inPeriod(e.at)).length,
    deletedPosts: events.filter((e) => e.kind === "deleted" && inPeriod(e.at)).length,
    medianHoursToFirstJoin: median(hoursToFirstJoin),
    undecided: { ...undecided, joinRate: rate(undecided.postsWithJoin, undecided.posts) },
    fixedGym: { ...fixedGym, joinRate: rate(fixedGym.postsWithJoin, fixedGym.posts) },
    pastJoins: pastJoinList.length,
    joinsWithVisit,
    joiners: new Set(periodJoins.map((j) => j.user)).size,
    visitingJoiners: new Set(visitedJoins.map((j) => j.user)).size,
    visitRate: rate(joinsWithVisit, pastJoinList.length),
    totalVisits: visitsInPeriod.length,
    activeUsers,
    visitsPerUserPerMonth: perUserMonth(visitsInPeriod.length),
    joinVisitsPerUserPerMonth: perUserMonth(joinsWithVisit),
    joinVisitShare: rate(joinsWithVisit, visitsInPeriod.length),
  };
}
