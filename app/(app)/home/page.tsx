import { HomeClient } from "@/components/home/HomeClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog, GymMaster, AreaMaster, User } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();
  const [logsRes, gymsRes, areasRes, usersRes] = await Promise.all([
    supabase.from("climbing_logs").select("*").order("date", { ascending: true }),
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("area_tag"),
    supabase.from("users").select("*").order("user_name"),
  ]);

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "home").catch(() => {});

  return (
    <HomeClient
      initialLogs={(logsRes.data || []) as ClimbingLog[]}
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
    />
  );
}
