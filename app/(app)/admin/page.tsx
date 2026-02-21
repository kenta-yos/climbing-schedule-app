import { AdminClient } from "@/components/admin/AdminClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GymMaster, AreaMaster, SetSchedule } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

const ADMIN_USER_ID = "8779bd4c-be62-49af-9a74-2fa035079ca9";

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

  const decodedUser = decodeURIComponent(userName);

  const [gymsRes, areasRes, schedulesRes, adminRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("major_area"),
    supabase.from("set_schedules").select("*").order("start_date", { ascending: false }),
    supabase.from("users").select("user_name").eq("id", ADMIN_USER_ID).single(),
  ]);

  const isAdmin = adminRes.data?.user_name === decodedUser;

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "admin").catch(() => {});

  return (
    <AdminClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      setSchedules={(schedulesRes.data || []) as SetSchedule[]}
      currentUser={decodedUser}
      isAdmin={isAdmin}
    />
  );
}
