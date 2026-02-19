import { LoginScreen } from "@/components/home/LoginScreen";
import { Toaster } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let users: User[] = [];
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("user_name");
    users = data || [];
  } catch (err) {
    console.error("Failed to fetch users:", err);
  }

  return (
    <>
      <LoginScreen users={users} />
      <Toaster />
    </>
  );
}
