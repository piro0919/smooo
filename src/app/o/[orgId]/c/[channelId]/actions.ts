"use server";

import { revalidatePath } from "next/cache";
import { formatMessage } from "@/lib/ai/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PostState = { error?: string; raw?: string; sent?: number };

// 打たれた文章を AI に整えさせ、整えた文面だけをチャンネルに出す。原文は本人だけが読める表に残す。
// 今は投稿のたびにその場で整形する。AI 同士の会話が入ったら、キューに積む形に移す
export async function postMessage(
  orgId: string,
  channelId: string,
  _prev: PostState,
  formData: FormData,
): Promise<PostState> {
  const raw = String(formData.get("raw") ?? "").trim();
  if (!raw) return {};
  if (raw.length > 4000) return { error: "長すぎます。4000文字までです。", raw };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが切れています。", raw };

  // 参加しているチャンネルかを、本人の権限で確かめる。見えなければ参加していない
  const { data: channel } = await supabase
    .from("channels")
    .select("name, audience, channel_members!inner(user_id)")
    .eq("id", channelId)
    .eq("channel_members.user_id", user.id)
    .maybeSingle();
  if (!channel) return { error: "このチャンネルには投稿できません。", raw };

  let body: string;
  try {
    body = await formatMessage(raw, {
      name: channel.name,
      audience: channel.audience === "external" ? "external" : "internal",
    });
  } catch (error) {
    console.error(error);
    return { error: "文面を整えられませんでした。もう一度送ってください。", raw };
  }

  const admin = createAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .insert({ channel_id: channelId, author_id: user.id, body })
    .select("id")
    .single();
  if (error) return { error: "投稿できませんでした。", raw };

  const { error: sourceError } = await admin
    .from("message_sources")
    .insert({ message_id: message.id, author_id: user.id, raw_text: raw });
  if (sourceError) {
    // 原文が残らない投稿は、本人が後から確かめられないので出さない
    await admin.from("messages").delete().eq("id", message.id);
    return { error: "投稿できませんでした。", raw };
  }

  revalidatePath(`/o/${orgId}/c/${channelId}`);
  return { sent: Date.now() };
}
