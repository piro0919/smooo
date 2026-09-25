import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Organization を開いたら、参加しているチャンネルの最初の一つを開く
export default async function OrgHome({ params }: PageProps<"/o/[orgId]">) {
  const { orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("channel_members")
    .select("channel_id, channels!inner(organization_id, name)")
    .eq("user_id", user!.id)
    .eq("channels.organization_id", orgId)
    .order("name", { referencedTable: "channels" })
    .limit(1);

  const first = data?.[0];
  if (first) redirect(`/o/${orgId}/c/${first.channel_id}`);

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
      まだチャンネルがありません。左の「チャンネルを追加する」から作れます。
    </div>
  );
}
