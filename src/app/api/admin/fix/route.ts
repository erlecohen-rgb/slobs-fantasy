import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("roster_players")
    .update({ primary_position: "OF" })
    .in("primary_position", ["LF", "CF", "RF"]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: data });
}
