import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 招待のリンクの受け口。ログインしていなければ proxy がログインへ送り、戻ってくる
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_invite", { invite_token: token });
  const target = data?.[0];

  if (error || !target) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        この招待リンクは使えません。有効期限が切れているか、URL が間違っています。
      </main>
    );
  }

  if (!target.channel_id) redirect(`/o/${target.organization_id}`);

  // 社外とのチャンネルは、自分の側の Organization の中に出す
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: home } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user!.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  redirect(`/o/${home?.organization_id ?? target.organization_id}/c/${target.channel_id}`);
}
