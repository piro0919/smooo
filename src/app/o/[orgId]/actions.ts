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
    return { error: "チャンネル名に使えるのは、小文字の英字、数字、日本語、ハイフン、アンダースコアです。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channels")
    .insert({ organization_id: orgId, name, audience })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "同じ名前のチャンネルがすでにあります。" };
    return { error: "チャンネルを作成できませんでした。" };
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

// 開いているチャンネルを既読にする。開いている間に届いた投稿も、画面に出た時点で既読にする
export async function markRead(orgId: string, channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("channel_reads")
    .upsert({ user_id: user.id, channel_id: channelId, last_read_at: new Date().toISOString() });
  revalidatePath(`/o/${orgId}`, "layout");
}

export type LeaveState = { error?: string };

export async function leaveOrganization(orgId: string): Promise<LeaveState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_organization", { org: orgId });
  if (error) {
    if (error.message.includes("last owner")) {
      return { error: "オーナーがあなただけのため、退出できません。" };
    }
    return { error: "退出できませんでした。" };
  }
  redirect("/");
}

export async function leaveChannel(orgId: string, channelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("channel_members").delete().eq("channel_id", channelId).eq("user_id", user.id);
  revalidatePath(`/o/${orgId}`, "layout");
  redirect(`/o/${orgId}`);
}
