import { notFound } from "next/navigation";
import { Globe, Hash, UserPlus } from "lucide-react";
import { BackToList } from "@/components/BackToList";
import { Composer } from "@/components/Composer";
import { ComposerTargetProvider } from "@/components/ComposerTarget";
import { LiveRefresh } from "@/components/LiveRefresh";
import { MarkRead } from "@/components/MarkRead";
import { InviteDialog } from "@/components/InviteDialog";
import { MessageList } from "@/components/MessageList";
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
        "id, name, kind, audience, organization_id, organizations(name), channel_members(user_id, profiles(display_name))",
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

  // 新しい順に100件取り、古い順に並べ直す
  const [{ data: latest }, { data: sources }, { data: reactions }] = isMember
    ? await Promise.all([
        supabase
          .from("messages")
          .select(
            "id, body, created_at, author_id, corrects, profiles!messages_author_id_fkey(display_name, avatar_url), parent:reply_to(body, profiles!messages_author_id_fkey(display_name))",
          )
          .eq("channel_id", channelId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("message_sources")
          .select("message_id, raw_text, kind, messages!inner(channel_id)")
          .eq("messages.channel_id", channelId),
        supabase
          .from("reactions")
          .select("message_id, emoji, profiles(display_name)")
          .eq("channel_id", channelId)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const messages = (latest ?? []).reverse();
  // 投稿ごとに、絵文字と付けた人の名前をまとめる
  const reactionsById = new Map<string, Map<string, string[]>>();
  for (const r of reactions ?? []) {
    const byEmoji =
      reactionsById.get(r.message_id) ?? new Map<string, string[]>();
    byEmoji.set(r.emoji, [
      ...(byEmoji.get(r.emoji) ?? []),
      r.profiles?.display_name ?? "?",
    ]);
    reactionsById.set(r.message_id, byEmoji);
  }
  const rawById = new Map(
    (sources ?? []).map((s) => [
      s.message_id,
      { text: s.raw_text, kind: s.kind },
    ]),
  );

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-5">
        <BackToList orgId={orgId} />
        {!isDm && <Icon className="size-4" />}
        <h2 className="truncate text-lg font-bold">{title}</h2>
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
                description={`このリンクから入った人は、#${channel.name} にだけ参加します。ほかのチャンネルや社内の人の一覧は見えません。`}
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
            <MessageList
              messages={messages}
              sources={rawById}
              reactions={reactionsById}
              userId={auth.user!.id}
            />
            <Composer
              orgId={orgId}
              channelId={channelId}
              placeholder={isDm ? `${title}さんへ` : `#${title} へ`}
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
            <Button type="submit">参加する</Button>
          </form>
        </div>
      )}
    </>
  );
}
