"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateChannelState = { error?: string };

// Slack と同じく、チャンネル名は小文字と数字とハイフン。日本語もそのまま使える
function normalizeName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function createChannel(
  orgId: string,
  _prev: CreateChannelState,
  formData: FormData,
): Promise<CreateChannelState> {
  const name = normalizeName(String(formData.get("name") ?? ""));
  const audience = formData.get("audience") === "external" ? "external" : "internal";

  if (!/^[a-z0-9ぁ-んァ-ヶー一-龯_-]{1,80}$/.test(name)) {
    return { error: "名前には、小文字の英字、数字、日本語、ハイフン、アンダースコアが使えます。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({ organization_id: orgId, name, audience })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "同じ名前のチャンネルがすでにあります。" };
    return { error: "チャンネルを作れませんでした。" };
  }

  revalidatePath(`/o/${orgId}`, "layout");
  redirect(`/o/${orgId}/c/${data.id}`);
}

export async function joinChannel(orgId: string, channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("channel_members").insert({ channel_id: channelId, user_id: user.id });
  revalidatePath(`/o/${orgId}`, "layout");
}

export async function startDm(orgId: string, otherId: string) {
  const supabase = await createClient();
  const { data: dm, error } = await supabase.rpc("create_dm", { org: orgId, other: otherId });
  if (error || !dm) throw error ?? new Error("create_dm returned nothing");
  revalidatePath(`/o/${orgId}`, "layout");
  redirect(`/o/${orgId}/c/${dm}`);
}
