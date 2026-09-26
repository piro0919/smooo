import { notFound } from "next/navigation";
import { Globe, Hash, UserPlus } from "lucide-react";
import { AiTyping } from "@/components/AiTyping";
import { BackToList } from "@/components/BackToList";
import { ChannelDetailsDialog } from "@/components/ChannelDetailsDialog";
import { Composer } from "@/components/Composer";
import { ComposerTargetProvider } from "@/components/ComposerTarget";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MarkRead } from "@/components/MarkRead";
import { InviteDialog } from "@/components/InviteDialog";
import { MessageList } from "@/components/MessageList";
import { loadMessages } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { joinChannel } from "../../actions";

export default async function ChannelPage({
  params,
}: PageProps<"/o/[orgId]/c/[channelId]">) {
  const { orgId, channelId } = await params;
  const supabase = await createClient();

  const [{ data: channel }, { data: auth }] = await Promise.all([
    supabase
      .from("channels")
      .select(
        "id, name, kind, audience, organization_id, organizations(name), channel_members(user_id, profiles(display_name, avatar_url))",
      )
      .eq("id", channelId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!channel) notFound();

  const isMember = channel.channel_members.some(
    (m) => m.user_id === auth.user?.id,
  );
  // よその会社のチャンネルは、招かれて参加している社外とのチャンネルだけ開ける
  const isGuest = channel.organization_id !== orgId;
  if (isGuest && !(channel.audience === "external" && isMember)) notFound();
  const Icon = channel.audience === "external" ? Globe : Hash;
  const isDm = channel.kind === "dm";
  // DM は相手の名前で呼ぶ
  const title = isDm
    ? (channel.channel_members.find((m) => m.user_id !== auth.user?.id)
        ?.profiles?.display_name ?? "?")
    : channel.name!;

  // 参加者のうち、チャンネルの持ち主の会社に属していない人に「社外」と添える。
  // 所属の一覧はその会社の人にしか見えないので、社外から招かれた人の画面では添えない
  const { data: insiders } = isGuest
    ? { data: null }
    : await supabase.from("memberships").select("user_id").eq("organization_id", channel.organization_id);
  const inside = new Set((insiders ?? []).map((m) => m.user_id));
  const people = channel.channel_members
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.display_name ?? "?",
      avatarUrl: m.profiles?.avatar_url ?? null,
      company: insiders && !inside.has(m.user_id) ? "社外" : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const LATEST = 100;
  const messages = isMember ? await loadMessages(supabase, channelId, { limit: LATEST }) : [];

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-5">
        <BackToList orgId={orgId} />
        <ChannelDetailsDialog
          orgId={orgId}
          channelId={channelId}
          title={isDm ? title : `#${title}`}
          canLeave={isMember && !isDm}
          members={people}
        >
          {!isDm && <Icon className="size-4 shrink-0" />}
          <h2 className="truncate text-lg font-bold">{title}</h2>
        </ChannelDetailsDialog>
        {isDm ? null : isGuest ? (
          <span className="hidden truncate text-sm text-muted-foreground md:inline">
            {channel.organizations?.name} とのチャンネル
          </span>
        ) : (
          channel.audience === "external" && (
            <>
              <span className="hidden text-sm text-muted-foreground md:inline">
                社外の人も参加できます
              </span>
              <InviteDialog
                orgId={orgId}
                channelId={channelId}
                title="社外の人を招待する"
                description={`このリンクから参加した人は、#${channel.name} だけに参加します。ほかのチャンネルや社内のメンバー一覧は見えません。`}
                trigger={
                  <button
                    aria-label="社外の人を招待"
                    className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-zinc-100"
                  />
                }
              >
                <UserPlus className="size-4" />
                <span className="hidden md:inline">社外の人を招待</span>
              </InviteDialog>
            </>
          )
        )}
      </header>
      {isMember ? (
        <>
          <LiveRefresh channelId={channelId} />
          <MarkRead orgId={orgId} channelId={channelId} latest={messages.at(-1)?.id} />
          <ComposerTargetProvider>
            <MessageList channelId={channelId} messages={messages} hasOlder={messages.length === LATEST} userId={auth.user!.id} orgId={orgId} />
            <AiTyping channelId={channelId} userId={auth.user!.id} />
            <Composer
              orgId={orgId}
              channelId={channelId}
              placeholder={isDm ? `${title}さんへのメッセージ` : `#${title} へのメッセージ`}
            />
          </ComposerTargetProvider>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
          <form
            action={joinChannel.bind(null, orgId, channelId)}
            className="grid gap-3"
          >
            <p>このチャンネルにはまだ参加していません。</p>
            <Button type="submit">チャンネルに参加する</Button>
          </form>
        </div>
      )}
    </>
  );
}
