import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();
  const { data } = await supabase
    .from("climbing_logs")
    .select("*")
    .eq("user", decodedUser)
    .order("date", { ascending: false });

  // ページビュー記録（非同期・fire-and-forget）
  addPageView(decodedUser, "dashboard").catch(() => {});

  return (
    <DashboardClient
      initialLogs={(data || []) as ClimbingLog[]}
      currentUser={decodedUser}
    />
  );
}
