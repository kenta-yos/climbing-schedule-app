"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExternalLink, Star } from "lucide-react";
import { getTopRecommendations } from "@/lib/scoring";
import { getNowJST, formatMMDD, getTodayJST, daysDiff } from "@/lib/utils";
import { MAJOR_AREA_ORDER } from "@/lib/constants";
import type { GymMaster, AreaMaster, ClimbingLog, SetSchedule, User } from "@/lib/supabase/queries";

type Props = {
  gyms: GymMaster[];
  areas: AreaMaster[];
  allLogs: ClimbingLog[];
  myLogs: ClimbingLog[];
  friendLogs: ClimbingLog[];
  setSchedules: SetSchedule[];
  users: User[];
  currentUser: string;
};

export function GymsClient({
  gyms, areas, allLogs, myLogs, friendLogs, setSchedules, currentUser,
}: Props) {
  const [targetDate, setTargetDate] = useState(getTodayJST());
  const [areaFilter, setAreaFilter] = useState<string>("すべて");

  const now = getNowJST();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  // 自分の訪問済みジム
  const visitedGymNames = new Set(
    myLogs.filter((l) => l.type === "実績").map((l) => l.gym_name)
  );

  // 最近30日の訪問
  const recentVisits = myLogs.filter(
    (l) => l.type === "実績" && l.date >= thirtyDaysAgo
  );
  const recentGymNames = new Set(recentVisits.map((l) => l.gym_name));

  // エリアフィルタリング
  const filteredGyms = areaFilter === "すべて"
    ? gyms
    : gyms.filter((g) => {
        const area = areas.find((a) => a.area_tag === g.area_tag);
        return area?.major_area === areaFilter;
      });

  // レコメンド
  const recommendations = getTopRecommendations({
    gymNames: filteredGyms.map((g) => g.gym_name),
    targetDate: new Date(targetDate + "T00:00:00+09:00"),
    allLogs,
    myLogs,
    setSchedules,
    friendLogs,
    topN: 5,
  });

  // 訪問済み/未訪問
  const visitedGyms = filteredGyms.filter((g) => visitedGymNames.has(g.gym_name));
  const unvisitedGyms = filteredGyms.filter((g) => !visitedGymNames.has(g.gym_name));

  // 最新の訪問日を取得
  const getLastVisit = (gymName: string) => {
    const visits = myLogs
      .filter((l) => l.gym_name === gymName && l.type === "実績")
      .sort((a, b) => b.date.localeCompare(a.date));
    return visits[0]?.date || null;
  };

  // 最新のセット日を取得
  const getLatestSetDate = (gymName: string) => {
    const schedules = setSchedules
      .filter((s) => s.gym_name === gymName)
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
    return schedules[0]?.start_date || null;
  };

  const GymRow = ({ gym, showLastVisit = false }: { gym: GymMaster; showLastVisit?: boolean }) => {
    const lastVisit = getLastVisit(gym.gym_name);
    const latestSet = getLatestSetDate(gym.gym_name);
    const isRecent = recentGymNames.has(gym.gym_name);
    const setAge = latestSet ? daysDiff(new Date(latestSet), now) : null;

    return (
      <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isRecent && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
            <span className="text-sm font-medium text-gray-800 truncate">{gym.gym_name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {latestSet !== null && setAge !== null && (
              <span className={`text-xs ${setAge <= 7 ? "text-orange-500 font-medium" : setAge <= 14 ? "text-yellow-600" : "text-gray-400"}`}>
                {setAge <= 7 ? "🔥" : setAge <= 14 ? "✨" : ""} セット {formatMMDD(latestSet)}〜
              </span>
            )}
            {showLastVisit && lastVisit && (
              <span className="text-xs text-gray-400">最終 {formatMMDD(lastVisit)}</span>
            )}
            {!latestSet && (
              <span className="text-xs text-gray-300">⚠️ スケジュール未登録</span>
            )}
          </div>
        </div>
        {gym.profile_url && (
          <a
            href={gym.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader title="ジム" />
      <div className="px-4 py-4 space-y-4 page-enter">
        {/* エリアフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["すべて", ...MAJOR_AREA_ORDER].map((area) => (
            <button
              key={area}
              onClick={() => setAreaFilter(area)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                areaFilter === area
                  ? "climbing-gradient text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* レコメンド */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800">🎯 おすすめジム</h2>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-36 text-xs h-8"
            />
          </div>
          {recommendations.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 text-center text-gray-400 text-sm border border-gray-100">
              該当するジムがありません
            </div>
          ) : (
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.gymName}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full climbing-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{rec.gymName}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rec.reasons.map((reason) => (
                        <Badge key={reason} variant="warning" className="text-xs px-1.5 py-0">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm font-bold gradient-text flex-shrink-0">{rec.score}pt</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ジム一覧 */}
        <Tabs defaultValue="visited">
          <TabsList>
            <TabsTrigger value="visited">✅ 訪問済 ({visitedGyms.length})</TabsTrigger>
            <TabsTrigger value="unvisited">🔍 未訪問 ({unvisitedGyms.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="visited">
            <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
              {visitedGyms.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">まだ訪問したジムがありません</div>
              ) : (
                visitedGyms.map((gym) => <GymRow key={gym.gym_name} gym={gym} showLastVisit />)
              )}
            </div>
          </TabsContent>
          <TabsContent value="unvisited">
            <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
              {unvisitedGyms.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">すべてのジムを訪問済みです！</div>
              ) : (
                unvisitedGyms.map((gym) => <GymRow key={gym.gym_name} gym={gym} />)
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
