import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("gym_master").select("*").order("gym_name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const { gym_name, profile_url, area_tag } = await request.json();
    if (!gym_name) return NextResponse.json({ error: "Missing gym_name" }, { status: 400 });
    const updates: Record<string, string | null> = {};
    if (profile_url !== undefined) updates.profile_url = profile_url || null;
    if (area_tag !== undefined) updates.area_tag = area_tag;
    const { error } = await supabase.from("gym_master").update(updates).eq("gym_name", gym_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { error } = await supabase.from("gym_master").insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
