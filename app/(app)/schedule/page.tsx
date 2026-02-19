import { ScheduleClient } from "@/components/schedule/ScheduleClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SetSchedule } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const supabase = createClient();
  const { data } = await supabase
    .from("set_schedules")
    .select("*")
    .order("start_date", { ascending: false });

  return <ScheduleClient schedules={(data || []) as SetSchedule[]} />;
}
