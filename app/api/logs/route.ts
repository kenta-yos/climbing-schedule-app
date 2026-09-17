import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJST, getNowJST, toJSTDateString } from "@/lib/utils";
import { fetchAllRows } from "@/lib/supabase/paginate";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const mode = searchParams.get("mode"); // "home" のときは絞り込み取得

    if (mode === "home") {
      // トップページ用：今日以降の全予定 + 今月の実績
      const today = getTodayJST();
      // 先月1日から取得（ランキングの先月タブ用）
      const now = getNowJST();
      const monthStart = toJSTDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));

      const [plans, logs] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase.from("climbing_logs").select("*").eq("type", "予定").gte("date", today).order("date", { ascending: true }).range(from, to)
        ),
        fetchAllRows((from, to) =>
          supabase.from("climbing_logs").select("*").eq("type", "実績").gte("date", monthStart).order("date", { ascending: false }).range(from, to)
        ),
      ]);
      return NextResponse.json([...plans, ...logs]);
    }

    // 1000 行で打ち切られると古い記録から落ちる。ジム訪問履歴は全期間を数えるので取り切る
    const rows = await fetchAllRows((from, to) => {
      let query = supabase.from("climbing_logs").select("*").order("date", { ascending: false });
      if (user) query = query.eq("user", user);
      return query.range(from, to);
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // 重複チェック: 同一ユーザー・日付・時間帯・タイプ
    if (body.user && body.date && body.time_slot && body.type) {
      const { data: existing } = await supabase
        .from("climbing_logs")
        .select("id")
        .eq("user", body.user)
        .eq("date", body.date)
        .eq("time_slot", body.time_slot)
        .eq("type", body.type)
        .limit(1);
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: "同じ予定・実績が既に登録されています" }, { status: 409 });
      }
    }

    const { error } = await supabase.from("climbing_logs").insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ログ登録のアクション記録（予定 or 実績）
    if (body.user && body.type) {
      const base = body.type === "予定" ? "plan_created" : "log_created";
      const detail = body.date && body.gym_name ? `${base}|${body.date}|${body.gym_name}` : base;
      supabase.from("page_views").insert({ user_name: body.user, page: "plan", action: detail }).then(() => {});
      // 効果測定の母数。予定行は消されるので、出された事実をここにも残す
      if (body.type === "予定" && body.date && body.gym_name) {
        supabase
          .from("plan_events")
          .insert({
            kind: "posted",
            date: body.date,
            gym_name: body.gym_name,
            user: body.user,
            actor: body.user,
            time_slot: body.time_slot ?? null,
          })
          .then(() => {});
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
