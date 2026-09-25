import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Globe, Hash, MessageCircleQuestion, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrowseChannelsDialog } from "@/components/BrowseChannelsDialog";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { LiveQuestions } from "@/components/LiveQuestions";
import { SettingsDialog } from "@/components/SettingsDialog";
import { cn } from "@/lib/utils";

const itemClass = "flex items-center gap-2 rounded-md px-3 py-1 text-[15px] hover:bg-white/10";

// Slack の画面の骨組みに倣う。左端に Organization の切り替え、その右にチャンネル一覧
export default async function OrgLayout({ children, params }: LayoutProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const [
    { data: memberships },
    { data: channels },
    { data: shared },
    { count: openQuestions },
    { data: me },
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("organization_id, organizations(id, name, personal)")
      .eq("user_id", userId)
      .order("created_at"),
    supabase
      .from("channels")
      .select("id, name, audience, channel_members(user_id)")
      .eq("organization_id", orgId)
      .order("name"),
    // 社外の会社に招かれたチャンネル。自分の側のサイドバーに出す
    supabase
      .from("channels")
      .select("id, name, organization_id, organizations(name), channel_members!inner(user_id)")
      .eq("audience", "external")
      .eq("channel_members.user_id", userId)
      .neq("organization_id", orgId)
      .order("name"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("profiles").select("autonomy, onboarded_at").eq("id", userId).single(),
  ]);

  // 使い始めの数問がまだなら、先にそちらへ
  if (me && !me.onboarded_at) redirect(`/welcome?next=/o/${orgId}`);

  const orgs = (memberships ?? []).flatMap((m) => (m.organizations ? [m.organizations] : []));
  const org = orgs.find((o) => o.id === orgId);
  if (!org) notFound();

  const mine = new Set(orgs.map((o) => o.id));
  const isMember = (c: { channel_members: { user_id: string }[] }) =>
    c.channel_members.some((m) => m.user_id === userId);
  const joined = (channels ?? []).filter(isMember);
  const unjoined = (channels ?? []).filter((c) => !isMember(c));
  // 自分が所属している別の Organization のチャンネルは、そちらの画面に出るので除く
  const guestChannels = (shared ?? []).filter((c) => !mine.has(c.organization_id));

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav className="flex w-[70px] shrink-0 flex-col items-center gap-3 bg-[#350d36] py-3">
        {orgs.map((o) => (
          <Link
            key={o.id}
            href={`/o/${o.id}`}
            title={o.name}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white",
              o.id === orgId && "ring-2 ring-white ring-offset-2 ring-offset-[#350d36]",
            )}
          >
            {o.name.slice(0, 1)}
          </Link>
        ))}
        <CreateOrgDialog />
      </nav>
      <aside className="flex w-[260px] shrink-0 flex-col bg-[#3f0e40] text-[#cfc3cf]">
        <header className="flex h-12 items-center justify-between gap-2 border-b border-white/10 pl-4 pr-2">
          <h1 className="truncate text-lg font-bold text-white">{org.name}</h1>
          <InviteDialog
            orgId={orgId}
            title={`${org.name} に招待する`}
            description="このリンクから入った人は、この Organization の一員になり、社内だけのチャンネルにも入れます。"
            trigger={
              <button
                aria-label="メンバーを招待する"
                className="rounded-md p-1.5 text-white hover:bg-white/10"
              />
            }
          >
            <UserPlus className="size-4" />
          </InviteDialog>
        </header>
        <div className="flex-1 overflow-y-auto py-3">
          <LiveQuestions userId={userId} />
          <div className="px-2 pb-3">
            <Link href={`/o/${orgId}/questions`} className={itemClass}>
              <MessageCircleQuestion className="size-4 shrink-0" />
              <span>あなたへの質問</span>
              {!!openQuestions && (
                <span className="ml-auto rounded-full bg-[#e01e5a] px-2 text-xs font-bold text-white">
                  {openQuestions}
                </span>
              )}
            </Link>
          </div>
          <p className="px-4 pb-1 text-[15px]">チャンネル</p>
          <ul className="grid px-2">
            {joined.map((c) => (
              <li key={c.id}>
                <Link href={`/o/${orgId}/c/${c.id}`} className={itemClass}>
                  {c.audience === "external" ? (
                    <Globe className="size-4 shrink-0" aria-label="社外の人も入れる" />
                  ) : (
                    <Hash className="size-4 shrink-0" />
                  )}
                  <span className="truncate">{c.name}</span>
                </Link>
              </li>
            ))}
            <li>
              <BrowseChannelsDialog orgId={orgId} channels={unjoined} />
            </li>
            <li>
              <CreateChannelDialog orgId={orgId} />
            </li>
          </ul>
          {guestChannels.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-4 text-[15px]">社外とのチャンネル</p>
              <ul className="grid px-2">
                {guestChannels.map((c) => (
                  <li key={c.id}>
                    <Link href={`/o/${orgId}/c/${c.id}`} className={itemClass}>
                      <Globe className="size-4 shrink-0" />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto truncate text-xs opacity-70">{c.organizations?.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="grid border-t border-white/10 p-2">
          <SettingsDialog autonomy={me?.autonomy ?? "standard"} />
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-md px-3 py-1 text-left text-sm hover:bg-white/10">
              ログアウト
            </button>
          </form>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-white">{children}</main>
    </div>
  );
}
