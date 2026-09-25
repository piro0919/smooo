import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  if (user) redirect("/");

  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-white px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Smooo</h1>
        <p className="text-muted-foreground">打ったとおりには、投稿されないチャット</p>
      </div>
      <LoginButton />
      {message && <p className="text-sm text-destructive">{message}</p>}
    </main>
  );
}
