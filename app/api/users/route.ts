import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("user_name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { user_name, color, icon } = await request.json();
    if (!user_name || !color || !icon) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const { error } = await supabase.from("users").insert({ user_name, color, icon });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ユーザー名を参照している他テーブル。改名時はここも追従させる。
// このアプリは外部キー制約を張らず、名前の文字列で紐付けているため。
const USER_NAME_REFERENCES: [table: string, column: string][] = [
  ["climbing_logs", "user"],
  ["work_shifts", "user_name"],
  ["page_views", "user_name"],
  ["access_logs", "user_name"],
  ["gym_master", "created_by"],
  ["release_announcements", "created_by"],
];

type Supabase = ReturnType<typeof createClient>;

/** 指定テーブルのユーザー名を from -> to に付け替える */
async function renameIn(
  supabase: Supabase,
  table: string,
  column: string,
  from: string,
  to: string
) {
  return supabase.from(table).update({ [column]: to }).eq(column, from);
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const { user_name, new_user_name, color, icon } = await request.json();
    if (!user_name) {
      return NextResponse.json({ error: "Missing user_name" }, { status: 400 });
    }

    const trimmed = typeof new_user_name === "string" ? new_user_name.trim() : "";
    const isRename = !!trimmed && trimmed !== user_name;

    const updates: Record<string, string> = {};
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    // ---- 改名しない場合はそのまま更新して終わり ----
    if (!isRename) {
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ success: true, user_name });
      }
      const { error } = await supabase.from("users").update(updates).eq("user_name", user_name);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, user_name });
    }

    // ---- 改名する場合 ----
    const { data: taken } = await supabase
      .from("users")
      .select("user_name")
      .eq("user_name", trimmed)
      .limit(1);
    if (taken && taken.length > 0) {
      return NextResponse.json(
        { error: "その名前はすでに使われています" },
        { status: 409 }
      );
    }
    updates.user_name = trimmed;

    // 参照テーブルを先に付け替え、最後に users を更新する。
    // 単一トランザクションにできないため、途中で失敗したら
    // それまでの変更を元の名前へ戻し、改名そのものを無かったことにする。
    const done: [string, string][] = [];

    const rollback = async () => {
      const failures: string[] = [];
      for (const [table, column] of done) {
        const { error } = await renameIn(supabase, table, column, trimmed, user_name);
        if (error) failures.push(table);
      }
      return failures;
    };

    const abort = async (reason: string) => {
      const failures = await rollback();
      if (failures.length > 0) {
        return NextResponse.json(
          {
            error:
              `${reason}。さらに巻き戻しにも失敗しました（${failures.join(", ")}）。` +
              `「${trimmed}」で保存し直すと復旧できます。`,
            rollbackFailed: true,
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: `${reason}。変更は取り消しました。` },
        { status: 500 }
      );
    };

    for (const [table, column] of USER_NAME_REFERENCES) {
      const { error } = await renameIn(supabase, table, column, user_name, trimmed);
      if (error) return abort(`${table} の更新に失敗しました`);
      done.push([table, column]);
    }

    const { error: userError } = await supabase
      .from("users")
      .update(updates)
      .eq("user_name", user_name);
    if (userError) return abort("ユーザー情報の更新に失敗しました");

    return NextResponse.json({ success: true, user_name: trimmed });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get("user_name");
    if (!userName) return NextResponse.json({ error: "Missing user_name" }, { status: 400 });
    const { error } = await supabase.from("users").delete().eq("user_name", userName);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
