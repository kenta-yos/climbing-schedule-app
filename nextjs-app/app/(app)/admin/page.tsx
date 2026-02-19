import { AdminClient } from "@/components/admin/AdminClient";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { GymMaster, AreaMaster } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = cookies();
  const userName = cookieStore.get("user_name")?.value;
  if (!userName) redirect("/");

  const supabase = createClient();
  const [gymsRes, areasRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("major_area"),
  ]);

  return (
    <AdminClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      currentUser={decodeURIComponent(userName)}
    />
  );
}
