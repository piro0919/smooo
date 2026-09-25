import { NextResponse, type NextRequest } from "next/server";
import { originOf } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${originOf(request)}/login`, { status: 303 });
}
