import { AdminClient } from "@/components/admin/AdminClient";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isAdminUser } from "@/lib/auth";
import { trackAction } from "@/lib/analytics";
import type { GymMaster, AreaMaster, Announcement, User } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const decodedUser = requireUser();
  const supabase = createClient();

  const [gymsRes, areasRes, isAdmin, announcementsRes, usersRes] = await Promise.all([
    supabase.from("gym_master").select("*").order("gym_name"),
    supabase.from("area_master").select("*").order("major_area"),
    isAdminUser(decodedUser),
    supabase.from("release_announcements").select("*").order("created_at", { ascending: false }),
    supabase.from("users").select("*").order("user_name"),
  ]);

  trackAction(decodedUser, "admin");

  return (
    <AdminClient
      gyms={(gymsRes.data || []) as GymMaster[]}
      areas={(areasRes.data || []) as AreaMaster[]}
      currentUser={decodedUser}
      isAdmin={isAdmin}
      announcements={(announcementsRes.data || []) as Announcement[]}
      users={(usersRes.data || []) as User[]}
    />
  );
}
