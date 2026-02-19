import { SCORING } from "./constants";
import { daysDiff, getNowJST } from "./utils";
import type { ClimbingLog, SetSchedule } from "./supabase/queries";

export type GymScore = {
  gymName: string;
  score: number;
  reasons: string[];
};

type ScoringParams = {
  gymName: string;
  targetDate?: Date;
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  friendLogs: ClimbingLog[];
};

// ジムのレコメンドスコアを計算（gyms.pyのロジックを忠実に移植）
export function scoreGym({
  gymName,
  targetDate,
  allLogs,
  myLogs,
  setSchedules,
  friendLogs,
}: ScoringParams): GymScore {
  const now = targetDate || getNowJST();
  let score = 0;
  const reasons: string[] = [];

  // 最新のセット日程を取得
  const gymSchedules = setSchedules
    .filter((s) => s.gym_name === gymName)
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

  const latestSchedule = gymSchedules[0];

  // 自分の最近の訪問を取得
  const myGymLogs = myLogs.filter(
    (l) => l.gym_name === gymName && l.type === "実績"
  );
  const myLatestVisit = myGymLogs.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  // セットの新鮮度スコア
  if (latestSchedule) {
    const setAge = daysDiff(new Date(latestSchedule.start_date), now);

    if (setAge >= 0 && setAge <= SCORING.FRESH_DAYS) {
      score += SCORING.FRESH_SCORE;
      reasons.push("🔥 新セット");
    } else if (setAge > SCORING.FRESH_DAYS && setAge <= SCORING.SEMI_FRESH_DAYS) {
      score += SCORING.SEMI_FRESH_SCORE;
      reasons.push("✨ やや新鮮");
    }

    // 自分がそのセットで既に登っていたらスキップ（スコアを下げる）
    if (myLatestVisit) {
      const visitAfterSet =
        new Date(myLatestVisit.date) >= new Date(latestSchedule.start_date);
      if (visitAfterSet && setAge <= SCORING.SEMI_FRESH_DAYS) {
        score -= 50; // 既に登ったジムは下げる
      }
    }
  }

  // 友達がいるスコア
  const todayStr = now.toISOString().split("T")[0];
  const friendsHere = friendLogs.filter(
    (l) =>
      l.gym_name === gymName &&
      l.type === "予定" &&
      l.date.startsWith(todayStr)
  );
  if (friendsHere.length > 0) {
    score += SCORING.FRIENDS_SCORE;
    reasons.push("👥 仲間がいる");
  }

  // 未訪問ボーナス
  if (myGymLogs.length === 0) {
    score += SCORING.UNVISITED_SCORE;
    reasons.push("🆕 未訪問");
  } else if (myLatestVisit) {
    // 長期未訪問ボーナス
    const daysSinceVisit = daysDiff(new Date(myLatestVisit.date), now);
    if (daysSinceVisit >= SCORING.OVERDUE_DAYS) {
      score += SCORING.OVERDUE_SCORE;
      reasons.push("⌛ 久しぶり");
    }
  }

  return { gymName, score, reasons };
}

// 全ジムをスコアリングして全件返す（件数制限なし、score降順）
export function scoreAllGyms({
  gymNames,
  targetDate,
  allLogs,
  myLogs,
  setSchedules,
  friendLogs,
}: {
  gymNames: string[];
  targetDate?: Date;
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  friendLogs: ClimbingLog[];
}): GymScore[] {
  return gymNames
    .map((gymName) =>
      scoreGym({ gymName, targetDate, allLogs, myLogs, setSchedules, friendLogs })
    )
    .sort((a, b) => b.score - a.score);
}

// 全ジムをスコアリングしてトップ5を返す
export function getTopRecommendations({
  gymNames,
  targetDate,
  allLogs,
  myLogs,
  setSchedules,
  friendLogs,
  topN = 5,
}: {
  gymNames: string[];
  targetDate?: Date;
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  friendLogs: ClimbingLog[];
  topN?: number;
}): GymScore[] {
  return gymNames
    .map((gymName) =>
      scoreGym({ gymName, targetDate, allLogs, myLogs, setSchedules, friendLogs })
    )
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
