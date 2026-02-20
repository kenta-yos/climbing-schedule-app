import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");

    let query = supabase.from("climbing_logs").select("*").order("date", { ascending: false });
    if (user) query = query.eq("user", user);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { error } = await supabase.from("climbing_logs").insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ログ登録のアクション記録（予定 or 実績）
    if (body.user && body.type) {
      const action = body.type === "予定" ? "plan_created" : "log_created";
      supabase.from("page_views").insert({ user_name: body.user, page: "home", action }).then(() => {});
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
