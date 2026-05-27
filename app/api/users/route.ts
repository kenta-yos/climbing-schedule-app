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

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const { user_name, color, icon } = await request.json();
    if (!user_name) {
      return NextResponse.json({ error: "Missing user_name" }, { status: 400 });
    }
    const updates: Record<string, string> = {};
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    const { error } = await supabase.from("users").update(updates).eq("user_name", user_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
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
