import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/next-path";
import { originOf } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

// Google から一度きりのコードを持って戻ってくる。セッションに引き換えて、元の行き先へ送る
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = originOf(request);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
}
