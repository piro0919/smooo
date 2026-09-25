import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/next-path";
import { originOf } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

// 開発時だけの入口。scripts/dev-session.mjs で作った試験用ユーザーでログインする。
// Google の OAuth クライアントがなくても、普段のブラウザで画面を見られるようにするため。
// 本番のビルドと、手元以外の Supabase では 404 を返す
export async function GET(request: NextRequest) {
  const local = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:");
  if (process.env.NODE_ENV !== "development" || !local) {
    return new NextResponse(null, { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email") ?? "a@example.test";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: "dev-session-password",
  });
  if (error) {
    return new NextResponse(`Run scripts/dev-session.mjs ${email} first.`, { status: 400 });
  }

  return NextResponse.redirect(
    `${originOf(request)}${safeNext(request.nextUrl.searchParams.get("next"))}`,
  );
}
