import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { cn } from "@/lib/utils";

// Slack の画面の骨組みに倣う。左端に Organization の切り替え、その右にチャンネル一覧
export default async function OrgLayout({ children, params }: LayoutProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const supabase = await createClient();

  const [{ data: orgs }, { data: channels }, { data: auth }] = await Promise.all([
    supabase.from("organizations").select("id, name, personal").order("personal").order("created_at"),
    supabase
      .from("channels")
      .select("id, name, audience, channel_members(user_id)")
      .eq("organization_id", orgId)
      .order("name"),
    supabase.auth.getUser(),
  ]);

  const org = orgs?.find((o) => o.id === orgId);
  if (!org) notFound();

  const userId = auth.user?.id;
  const joined = (channels ?? []).filter((c) =>
    c.channel_members.some((m) => m.user_id === userId),
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav className="flex w-[70px] shrink-0 flex-col items-center gap-3 bg-[#350d36] py-3">
        {orgs?.map((o) => (
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
      </nav>
      <aside className="flex w-[260px] shrink-0 flex-col bg-[#3f0e40] text-[#cfc3cf]">
        <header className="flex h-12 items-center border-b border-white/10 px-4">
          <h1 className="truncate text-lg font-bold text-white">{org.name}</h1>
        </header>
        <div className="flex-1 overflow-y-auto py-3">
          <p className="px-4 pb-1 text-[15px]">チャンネル</p>
          <ul className="grid px-2">
            {joined.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/o/${orgId}/c/${c.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-1 text-[15px] hover:bg-white/10"
                >
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
              <CreateChannelDialog orgId={orgId} />
            </li>
          </ul>
        </div>
        <form action="/auth/signout" method="post" className="border-t border-white/10 p-2">
          <button className="w-full rounded-md px-3 py-1 text-left text-sm hover:bg-white/10">
            ログアウト
          </button>
        </form>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-white">{children}</main>
    </div>
  );
}
