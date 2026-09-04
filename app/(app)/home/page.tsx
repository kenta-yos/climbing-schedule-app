import { HomeClient } from "@/components/home/HomeClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getTodayJST, getNowJST, toJSTDateString } from "@/lib/utils";
import { trackAction } from "@/lib/analytics";
import type { ClimbingLog, User, Announcement, WorkShift } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const decodedUser = requireUser();

  const supabase = createClient();

  const todayStr = getTodayJST();
  const now = getNowJST();
  const monthStart = toJSTDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const [futurePlansRes, monthlyLogsRes, usersRes, announcementsRes, shiftsRes] = await Promise.all([
    supabase.from("climbing_logs").select("*").eq("type", "予定").gte("date", todayStr).order("date", { ascending: true }),
    supabase.from("climbing_logs").select("*").eq("type", "実績").gte("date", monthStart).order("date", { ascending: false }),
    supabase.from("users").select("*").order("user_name"),
    supabase.from("release_announcements").select("*").gte("display_until", todayStr).order("created_at", { ascending: false }),
    supabase.from("work_shifts").select("*").gte("date", todayStr).order("date", { ascending: true }),
  ]);

  const initialLogs = [...(futurePlansRes.data || []), ...(monthlyLogsRes.data || [])];

  trackAction(decodedUser, "home");

  return (
    <HomeClient
      initialLogs={initialLogs as ClimbingLog[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
      announcements={(announcementsRes.data || []) as Announcement[]}
      initialShifts={(shiftsRes.data || []) as WorkShift[]}
    />
  );
}
