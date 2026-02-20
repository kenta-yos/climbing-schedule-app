import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const mode = searchParams.get("mode"); // "home" のときは絞り込み取得

    if (mode === "home") {
      // トップページ用：今日〜3週間後の予定 + 今月の実績のみ
      const now = new Date();
      const toJST = (d: Date) =>
        d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
          .replace(/\//g, "-")
          .replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, day) => `${y}-${m.padStart(2,"0")}-${day.padStart(2,"0")}`);
      const today = toJST(now);
      const cutoff = toJST(new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000));
      const monthStart = today.slice(0, 7) + "-01";

      const [plansRes, logsRes] = await Promise.all([
        supabase.from("climbing_logs").select("*").eq("type", "予定").gte("date", today).lte("date", cutoff).order("date", { ascending: true }),
        supabase.from("climbing_logs").select("*").eq("type", "実績").gte("date", monthStart).order("date", { ascending: false }),
      ]);
      if (plansRes.error) return NextResponse.json({ error: plansRes.error.message }, { status: 500 });
      if (logsRes.error) return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
      return NextResponse.json([...(plansRes.data || []), ...(logsRes.data || [])]);
    }

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
