import { notFound } from "next/navigation";
import { Globe, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { joinChannel } from "../../actions";

export default async function ChannelPage({ params }: PageProps<"/o/[orgId]/c/[channelId]">) {
  const { orgId, channelId } = await params;
  const supabase = await createClient();

  const [{ data: channel }, { data: auth }] = await Promise.all([
    supabase
      .from("channels")
      .select("id, name, audience, organization_id, channel_members(user_id)")
      .eq("id", channelId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!channel || channel.organization_id !== orgId) notFound();

  const isMember = channel.channel_members.some((m) => m.user_id === auth.user?.id);
  const Icon = channel.audience === "external" ? Globe : Hash;

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-5">
        <Icon className="size-4" />
        <h2 className="truncate text-lg font-bold">{channel.name}</h2>
        {channel.audience === "external" && (
          <span className="text-sm text-muted-foreground">社外の人も参加できます</span>
        )}
      </header>
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        {isMember ? (
          "まだ投稿はありません。"
        ) : (
          <form action={joinChannel.bind(null, orgId, channelId)} className="grid gap-3">
            <p>このチャンネルにはまだ参加していません。</p>
            <Button type="submit">参加する</Button>
          </form>
        )}
      </div>
    </>
  );
}
