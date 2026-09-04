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

    if (isRename) {
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
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, user_name });
    }

    const { error } = await supabase.from("users").update(updates).eq("user_name", user_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!isRename) return NextResponse.json({ success: true, user_name });

    // 参照テーブルを新しい名前に追従させる。
    // トランザクションではないため、途中で失敗した場合は失敗したテーブル名を返す。
    const failedTables: string[] = [];
    for (const [table, column] of USER_NAME_REFERENCES) {
      const { error: refError } = await supabase
        .from(table)
        .update({ [column]: trimmed })
        .eq(column, user_name);
      if (refError) failedTables.push(table);
    }

    if (failedTables.length > 0) {
      return NextResponse.json(
        {
          error: `名前は変更しましたが、一部の履歴を更新できませんでした（${failedTables.join(", ")}）`,
          user_name: trimmed,
          partial: true,
        },
        { status: 500 }
      );
    }

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
