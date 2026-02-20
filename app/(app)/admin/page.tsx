import { AdminClient } from "@/components/admin/AdminClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GymMaster, AreaMaster, SetSchedule } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const supabase = createClient();

  // 1年以上前のセットスケジュールを自動削除（サイレント）
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  await supabase.from("set_schedules").delete().lt("start_date", cutoff);

  const [gymsRes, areasRes, schedulesRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("major_area"),
    supabase.from("set_schedules").select("*").order("start_date", { ascending: false }),
  ]);

  return (
    <AdminClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      setSchedules={(schedulesRes.data || []) as SetSchedule[]}
      currentUser={decodeURIComponent(userName)}
    />
  );
}
