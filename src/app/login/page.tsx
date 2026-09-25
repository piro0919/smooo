import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/next-path";
import { LoginButton } from "./LoginButton";

const ERRORS: Record<string, string> = {
  missing_code: "ログインが途中で止まりました。もう一度お試しください。",
  exchange_failed: "ログインを確認できませんでした。もう一度お試しください。",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error, next: nextParam } = await searchParams;
  const next = safeNext(typeof nextParam === "string" ? nextParam : undefined);
  if (user) redirect(next);

  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-white px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Smooo</h1>
        <p className="text-muted-foreground">打ったとおりには、投稿されないチャット</p>
      </div>
      <LoginButton next={next} />
      {message && <p className="text-sm text-destructive">{message}</p>}
    </main>
  );
}
