import { notFound } from "next/navigation";
import { Globe, Hash, UserPlus } from "lucide-react";
import { Composer } from "@/components/Composer";
import { LiveRefresh } from "@/components/LiveRefresh";
import { InviteDialog } from "@/components/InviteDialog";
import { MessageList } from "@/components/MessageList";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { joinChannel } from "../../actions";

export default async function ChannelPage({ params }: PageProps<"/o/[orgId]/c/[channelId]">) {
  const { orgId, channelId } = await params;
  const supabase = await createClient();

  const [{ data: channel }, { data: auth }] = await Promise.all([
    supabase
      .from("channels")
      .select("id, name, audience, organization_id, organizations(name), channel_members(user_id)")
      .eq("id", channelId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!channel) notFound();

  const isMember = channel.channel_members.some((m) => m.user_id === auth.user?.id);
  // よその会社のチャンネルは、招かれて参加している社外とのチャンネルだけ開ける
  const isGuest = channel.organization_id !== orgId;
  if (isGuest && !(channel.audience === "external" && isMember)) notFound();
  const Icon = channel.audience === "external" ? Globe : Hash;

  // 新しい順に100件取り、古い順に並べ直す
  const [{ data: latest }, { data: sources }] = isMember
    ? await Promise.all([
        supabase
          .from("messages")
          .select("id, body, created_at, author_id, profiles(display_name, avatar_url)")
          .eq("channel_id", channelId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("message_sources")
          .select("message_id, raw_text, messages!inner(channel_id)")
          .eq("messages.channel_id", channelId),
      ])
    : [{ data: [] }, { data: [] }];
  const messages = (latest ?? []).reverse();
  const rawById = new Map((sources ?? []).map((s) => [s.message_id, s.raw_text]));

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-5">
        <Icon className="size-4" />
        <h2 className="truncate text-lg font-bold">{channel.name}</h2>
        {isGuest ? (
          <span className="text-sm text-muted-foreground">{channel.organizations?.name} とのチャンネル</span>
        ) : (
          channel.audience === "external" && (
            <>
              <span className="text-sm text-muted-foreground">社外の人も参加できます</span>
              <InviteDialog
                orgId={orgId}
                channelId={channelId}
                title="社外の人を招待する"
                description={`このリンクから入った人は、#${channel.name} にだけ参加します。ほかのチャンネルや社内の人の一覧は見えません。`}
                trigger={
                  <button className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-zinc-100" />
                }
              >
                <UserPlus className="size-4" />
                社外の人を招待
              </InviteDialog>
            </>
          )
        )}
      </header>
      {isMember ? (
        <>
          <LiveRefresh channelId={channelId} />
          <MessageList messages={messages} sources={rawById} />
          <Composer orgId={orgId} channelId={channelId} channelName={channel.name} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
          <form action={joinChannel.bind(null, orgId, channelId)} className="grid gap-3">
            <p>このチャンネルにはまだ参加していません。</p>
            <Button type="submit">参加する</Button>
          </form>
        </div>
      )}
    </>
  );
}
