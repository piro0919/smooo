import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Globe, Hash, MessageCircleQuestion, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrowseChannelsDialog } from "@/components/BrowseChannelsDialog";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { LiveSidebar } from "@/components/LiveSidebar";
import { MembersDialog } from "@/components/MembersDialog";
import { OrgShell } from "@/components/OrgShell";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StartDmDialog } from "@/components/StartDmDialog";
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
    { data: dms },
    { data: orgPeople },
    { data: unreadIds },
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
      .eq("kind", "channel")
      .order("name"),
    // 社外の会社に招かれたチャンネル。自分の側のサイドバーに出す
    supabase
      .from("channels")
      .select("id, name, organization_id, organizations(name), channel_members!inner(user_id)")
      .eq("audience", "external")
      .eq("kind", "channel")
      .eq("channel_members.user_id", userId)
      .neq("organization_id", orgId)
      .order("name"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("profiles").select("display_name, autonomy, onboarded_at").eq("id", userId).single(),
    // 自分の DM。相手の名前を出すので参加者も取る
    supabase
      .from("channels")
      .select("id, channel_members(user_id, profiles(display_name))")
      .eq("organization_id", orgId)
      .eq("kind", "dm"),
    supabase
      .from("memberships")
      .select("user_id, role, profiles(display_name)")
      .eq("organization_id", orgId),
    supabase.rpc("unread_channel_ids"),
  ]);
  const unread = new Set(unreadIds ?? []);
  // 未読のあるチャンネルは、Slack と同じく名前を太字にする
  const itemFor = (id: string) => cn(itemClass, unread.has(id) && "font-bold text-white");

  // 使い始めの数問がまだなら、先にそちらへ
  if (me && !me.onboarded_at) redirect(`/welcome?next=/o/${orgId}`);

  const orgs = (memberships ?? []).flatMap((m) => (m.organizations ? [m.organizations] : []));
  const org = orgs.find((o) => o.id === orgId);
  if (!org) notFound();

  const mine = new Set(orgs.map((o) => o.id));
  const isMember = (c: { channel_members: { user_id: string }[] }) =>
    c.channel_members.some((m) => m.user_id === userId);
  const joined = (channels ?? []).filter(isMember);
  const dmList = (dms ?? [])
    .map((d) => ({
      id: d.id,
      name: d.channel_members.find((m) => m.user_id !== userId)?.profiles?.display_name ?? "?",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const members = (orgPeople ?? [])
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.display_name ?? "?",
      owner: m.role === "owner",
      me: m.user_id === userId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const people = members.filter((m) => !m.me);
  const unjoined = (channels ?? []).filter((c) => !isMember(c));
  // 自分が所属している別の Organization のチャンネルは、そちらの画面に出るので除く
  const guestChannels = (shared ?? []).filter((c) => !mine.has(c.organization_id));

  return (
    <OrgShell
      orgId={orgId}
      side={
    <>
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
      <aside className="flex min-w-0 flex-1 flex-col bg-[#3f0e40] text-[#cfc3cf] md:w-[260px] md:flex-none">
        <header className="flex h-12 items-center justify-between gap-2 border-b border-white/10 pl-4 pr-2">
          <h1 className="truncate text-lg font-bold text-white">{org.name}</h1>
          <div className="flex items-center">
          <MembersDialog orgId={orgId} orgName={org.name} personal={org.personal} members={members} />
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
          </div>
        </header>
        <div className="flex-1 overflow-y-auto py-3">
          <LiveSidebar userId={userId} />
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
                <Link href={`/o/${orgId}/c/${c.id}`} className={itemFor(c.id)}>
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
              <BrowseChannelsDialog orgId={orgId} channels={unjoined.map((c) => ({ ...c, name: c.name ?? "" }))} />
            </li>
            <li>
              <CreateChannelDialog orgId={orgId} />
            </li>
          </ul>
          <p className="px-4 pb-1 pt-4 text-[15px]">ダイレクトメッセージ</p>
          <ul className="grid px-2">
            {dmList.map((d) => (
              <li key={d.id}>
                <Link href={`/o/${orgId}/c/${d.id}`} className={itemFor(d.id)}>
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-white/20 text-[10px] font-bold">
                    {d.name.slice(0, 1)}
                  </span>
                  <span className="truncate">{d.name}</span>
                </Link>
              </li>
            ))}
            <li>
              <StartDmDialog orgId={orgId} people={people} />
            </li>
          </ul>
          {guestChannels.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-4 text-[15px]">社外とのチャンネル</p>
              <ul className="grid px-2">
                {guestChannels.map((c) => (
                  <li key={c.id}>
                    <Link href={`/o/${orgId}/c/${c.id}`} className={itemFor(c.id)}>
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
          <SettingsDialog autonomy={me?.autonomy ?? "standard"} name={me?.display_name ?? ""} />
          <form action="/auth/signout" method="post">
            <button className="w-full rounded-md px-3 py-1 text-left text-sm hover:bg-white/10">
              ログアウト
            </button>
          </form>
        </div>
      </aside>
    </>
      }
    >
      {children}
    </OrgShell>
  );
}
