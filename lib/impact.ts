/**
 * アプリの効果測定。
 *
 * 「作成された予定にどれくらい参加が発生したか」と、
 * 「アプリが無ければ起きなかったと思われるジム来訪がどれくらいか」を
 * climbing_logs だけから推定する。page_views のイベントは 1 テーブルに
 * 貯まり続ける都合で古いものから失われる可能性があり、また
 * 計測コードが入る前の期間を遡れないため、ここでは使わない。
 *
 * ## 参加の判定
 *
 * 予定は「日付 × ジム名」で 1 つの募集とみなす。同じ組の中で最初に作られた
 * ログを起点（seed）、それより後に別の人が作ったログを合流（join）とする。
 * ただし予定入力画面で「一緒に登るメンバー」を選ぶと、本人と仲間のログが
 * ほぼ同時刻に一括で作られる。これは本人が代理登録しただけで合流ではないため、
 * 直前のログとの間隔が SIMULTANEOUS_WINDOW_MS 以内なら同時登録として除外する。
 *
 * ## 来訪の判定
 *
 * 予定と実績は独立したテーブル行で、予定から実績への昇格は無い。そのため
 * 「合流した人が実際に登ったか」は、同じユーザー・同じ日付の実績があるかで見る。
 */

/** ジム未定で登録したときに gym_name に入る文字列 */
export const GYM_UNDECIDED_LABEL = "ジム未定";

/** これ以内に連続して作られたログは、同行者の一括登録とみなす */
export const SIMULTANEOUS_WINDOW_MS = 2 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375;

export type ImpactLog = {
  date: string;
  gym_name: string;
  user: string;
  type: string;
  created_at: string | null;
};

export type Join = {
  date: string;
  gym: string;
  seedUser: string;
  joiner: string;
  /** 起点の予定が作られてから合流するまでの時間 */
  hoursAfterSeed: number;
  /** 同じユーザー・同じ日付の実績が残っているか */
  visited: boolean;
};

export type ImpactResult = {
  label: string;
  /** 集計対象の月数。1人あたり月次の指標を出すのに使う */
  months: number;

  // --- 参加率 ---
  /** 起点となった予定の数（＝募集の数） */
  seedPlans: number;
  /** そのうち 1 件以上の合流がついたもの */
  joinedPlans: number;
  /** joinedPlans / seedPlans */
  joinRate: number;
  /** 合流の延べ件数 */
  joins: number;
  /** 同時登録（同行者の一括登録）として除外した件数 */
  companionLogs: number;
  /** created_at が無く判定できなかった予定の件数 */
  undated: number;
  /** ジム未定（登る仲間を募集中）の予定だけを見た場合 */
  undecided: { seedPlans: number; joinedPlans: number; joinRate: number };
  /** ジムを決めて出した予定だけを見た場合 */
  fixedGym: { seedPlans: number; joinedPlans: number; joinRate: number };
  /** 起点から最初の合流までの時間の中央値 */
  medianHoursToJoin: number | null;

  // --- 来訪 ---
  /** 期間内の実績の総数 */
  totalVisits: number;
  /** 合流した予定のうち、実績まで残った来訪 */
  joinVisits: number;
  /** 予定を出さずに他人の予定へ相乗りしたと見られる実績 */
  shadowVisits: number;
  /** joinVisits / joins */
  visitConversion: number;
  /** 期間内に 1 件以上ログがあるユーザー数（＝実効ユーザー数） */
  activeUsers: number;
  /** 実効ユーザー 1 人あたり月あたりの来訪数 */
  visitsPerUserPerMonth: number;
  /** 同じく、アプリ由来と見られる来訪数（反実仮想の割引前） */
  appDrivenPerUserPerMonth: number;
  /** アプリ由来と見られる来訪が全来訪に占める割合 */
  appDrivenShare: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 期間内のログから効果指標を組み立てる。
 * sinceDate を省略すると全期間を対象にする。日付はいずれも YYYY-MM-DD。
 */
export function analyzeImpact(
  logs: ImpactLog[],
  { label, sinceDate }: { label: string; sinceDate?: string }
): ImpactResult {
  const inPeriod = sinceDate ? logs.filter((l) => l.date >= sinceDate) : logs;

  const plans = inPeriod.filter((l) => l.type === "予定");
  const results = inPeriod.filter((l) => l.type === "実績");

  // 実績の有無を引くための索引
  const visitKeys = new Set(results.map((l) => `${l.user}|${l.date}`));

  // --- 予定を「日付 × ジム」でまとめ、起点と合流に分ける ---
  const groups = new Map<string, ImpactLog[]>();
  let undated = 0;
  for (const plan of plans) {
    if (!plan.created_at) {
      undated++;
      continue;
    }
    const key = `${plan.date}|${plan.gym_name}`;
    const group = groups.get(key);
    if (group) group.push(plan);
    else groups.set(key, [plan]);
  }

  const joins: Join[] = [];
  let companionLogs = 0;
  let seedPlans = 0;
  let joinedPlans = 0;
  const undecided = { seedPlans: 0, joinedPlans: 0 };
  const fixedGym = { seedPlans: 0, joinedPlans: 0 };
  const hoursToFirstJoin: number[] = [];

  for (const group of Array.from(groups.values())) {
    const sorted = [...group].sort(
      (a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
    );
    const seed = sorted[0];
    const seedAt = new Date(seed.created_at!).getTime();
    const isUndecided = seed.gym_name === GYM_UNDECIDED_LABEL;

    seedPlans++;
    if (isUndecided) undecided.seedPlans++;
    else fixedGym.seedPlans++;

    const groupJoins: Join[] = [];
    let previousAt = seedAt;
    for (const log of sorted.slice(1)) {
      const at = new Date(log.created_at!).getTime();
      // 直前のログと同時刻に近ければ、同行者として一括登録された分
      if (at - previousAt <= SIMULTANEOUS_WINDOW_MS) {
        companionLogs++;
        previousAt = at;
        continue;
      }
      previousAt = at;
      // 同じ人が予定を出し直した場合は合流として数えない
      if (log.user === seed.user) continue;
      groupJoins.push({
        date: log.date,
        gym: log.gym_name,
        seedUser: seed.user,
        joiner: log.user,
        hoursAfterSeed: (at - seedAt) / (60 * 60 * 1000),
        visited: visitKeys.has(`${log.user}|${log.date}`),
      });
    }

    if (groupJoins.length > 0) {
      joinedPlans++;
      if (isUndecided) undecided.joinedPlans++;
      else fixedGym.joinedPlans++;
      hoursToFirstJoin.push(Math.min(...groupJoins.map((j) => j.hoursAfterSeed)));
      joins.push(...groupJoins);
    }
  }

  // --- 予定を出さずに相乗りした実績 ---
  // 他人の予定が先に存在する日・ジムに、自分の予定は無いまま実績だけ残した場合。
  // 予定の作成時刻が実績の作成時刻より前であることを条件にして、
  // 「後から他人が同じ日を登録しただけ」を除く。
  const planKeys = new Set(plans.map((l) => `${l.user}|${l.date}`));
  const earliestPlanAt = new Map<string, number>();
  for (const plan of plans) {
    if (!plan.created_at) continue;
    const key = `${plan.date}|${plan.gym_name}`;
    const at = new Date(plan.created_at).getTime();
    const current = earliestPlanAt.get(key);
    if (current === undefined || at < current) earliestPlanAt.set(key, at);
  }

  let shadowVisits = 0;
  for (const visit of results) {
    if (!visit.created_at) continue;
    if (planKeys.has(`${visit.user}|${visit.date}`)) continue;
    const seedAt = earliestPlanAt.get(`${visit.date}|${visit.gym_name}`);
    if (seedAt === undefined) continue;
    if (seedAt >= new Date(visit.created_at).getTime()) continue;
    // その予定が自分以外の誰かのものであること
    const others = plans.some(
      (p) => p.date === visit.date && p.gym_name === visit.gym_name && p.user !== visit.user
    );
    if (others) shadowVisits++;
  }

  // --- 期間と実効ユーザー ---
  const dates = inPeriod.map((l) => l.date).sort();
  const spanDays =
    dates.length > 0
      ? (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / MS_PER_DAY + 1
      : 0;
  const periodDays = sinceDate
    ? Math.max((Date.now() - new Date(sinceDate).getTime()) / MS_PER_DAY, 1)
    : Math.max(spanDays, 1);
  const months = periodDays / DAYS_PER_MONTH;

  const activeUsers = new Set(inPeriod.map((l) => l.user)).size;
  const joinVisits = joins.filter((j) => j.visited).length;
  const appDriven = joinVisits + shadowVisits;
  const perUserMonth = (value: number) =>
    activeUsers === 0 || months === 0 ? 0 : value / activeUsers / months;

  return {
    label,
    months,
    seedPlans,
    joinedPlans,
    joinRate: rate(joinedPlans, seedPlans),
    joins: joins.length,
    companionLogs,
    undated,
    undecided: { ...undecided, joinRate: rate(undecided.joinedPlans, undecided.seedPlans) },
    fixedGym: { ...fixedGym, joinRate: rate(fixedGym.joinedPlans, fixedGym.seedPlans) },
    medianHoursToJoin: median(hoursToFirstJoin),
    totalVisits: results.length,
    joinVisits,
    shadowVisits,
    visitConversion: rate(joinVisits, joins.length),
    activeUsers,
    visitsPerUserPerMonth: perUserMonth(results.length),
    appDrivenPerUserPerMonth: perUserMonth(appDriven),
    appDrivenShare: rate(appDriven, results.length),
  };
}
