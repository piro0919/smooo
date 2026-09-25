import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// トップは入口だけ。所属している Organization の最初の一つへ送る。
// 会社の Organization があればそちらを、なければ本人だけの Organization を開く
export default async function Home() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, personal, created_at")
    .order("personal")
    .order("created_at")
    .limit(1);

  const org = orgs?.[0];
  if (!org) redirect("/login");
  redirect(`/o/${org.id}`);
}
