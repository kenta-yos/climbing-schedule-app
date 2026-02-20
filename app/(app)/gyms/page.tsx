import { GymsClient } from "@/components/gyms/GymsClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog, GymMaster, AreaMaster, SetSchedule, User } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function GymsPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);
  const supabase = createClient();

  const [gymsRes, areasRes, allLogsRes, myLogsRes, schedulesRes, usersRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("area_tag"),
    supabase.from("climbing_logs").select("*").order("date", { ascending: false }),
    supabase.from("climbing_logs").select("*").eq("user", decodedUser).order("date", { ascending: false }),
    supabase.from("set_schedules").select("*").order("start_date", { ascending: false }),
    supabase.from("users").select("*"),
  ]);

  const allLogs = (allLogsRes.data || []) as ClimbingLog[];
  const friendLogs = allLogs.filter((l) => l.user !== decodedUser);

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "gyms").catch(() => {});

  return (
    <GymsClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      allLogs={allLogs}
      myLogs={(myLogsRes.data || []) as ClimbingLog[]}
      friendLogs={friendLogs}
      setSchedules={(schedulesRes.data || []) as SetSchedule[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
    />
  );
}
