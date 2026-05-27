import { HomeClient } from "@/components/home/HomeClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ClimbingLog, User, Announcement } from "@/lib/supabase/queries";
import { addPageView } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const decodedUser = decodeURIComponent(userName);

  const supabase = createClient();

  const todayStr = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }).replace(/\//g, "-").replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
  const nowDate = new Date();
  const lastMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
  const monthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const [futurePlansRes, monthlyLogsRes, usersRes, announcementsRes] = await Promise.all([
    supabase.from("climbing_logs").select("*").eq("type", "予定").gte("date", todayStr).order("date", { ascending: true }),
    supabase.from("climbing_logs").select("*").eq("type", "実績").gte("date", monthStart).order("date", { ascending: false }),
    supabase.from("users").select("*").order("user_name"),
    supabase.from("release_announcements").select("*").gte("display_until", todayStr).order("created_at", { ascending: false }),
  ]);

  const initialLogs = [...(futurePlansRes.data || []), ...(monthlyLogsRes.data || [])];

  addPageView(decodedUser, "home").catch(() => {});

  return (
    <HomeClient
      initialLogs={initialLogs as ClimbingLog[]}
      users={(usersRes.data || []) as User[]}
      currentUser={decodedUser}
      announcements={(announcementsRes.data || []) as Announcement[]}
    />
  );
}
