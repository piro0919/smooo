"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { formatFor, loadChannel, respondToMessage, reviseAfterCorrection } from "@/lib/ai/pipeline";
import { loadMessages } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PostState = { error?: string; raw?: string; sent?: number };

// 打たれた文章を AI に整えさせ、整えた文面だけをチャンネルに出す。原文は本人だけが読める表に残す。
// 今は投稿のたびにその場で整形し、返事は応答を返したあとに作る。量が増えたらキューに移す
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

  // 返信先と訂正先は、同じチャンネルの投稿に限る。訂正できるのは自分の名前の投稿だけ
  const replyTo = String(formData.get("reply_to") ?? "") || null;
  const corrects = String(formData.get("corrects") ?? "") || null;
  const target = corrects ?? replyTo;
  if (target) {
    const { data: parent } = await supabase
      .from("messages")
      .select("author_id, channel_id")
      .eq("id", target)
      .maybeSingle();
    if (!parent || parent.channel_id !== channelId) return { error: "返信先の投稿が見つかりません。", raw };
    if (corrects && parent.author_id !== user.id) return { error: "訂正できるのは自分の投稿だけです。", raw };
  }

  let body: string;
  try {
    body = await formatFor(user.id, await loadChannel(channelId), raw);
  } catch (error) {
    console.error(error);
    return { error: "文面を整えられませんでした。もう一度送ってください。", raw };
  }

  const admin = createAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .insert({ channel_id: channelId, author_id: user.id, body, reply_to: target, corrects })
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

  // 返事を求められた人の AI が、答えるか本人に聞く。投稿した人を待たせないよう後で動かす
  after(async () => {
    try {
      if (corrects) await reviseAfterCorrection(message.id);
      await respondToMessage(message.id);
    } catch (error) {
      console.error("respondToMessage", error);
    }
  });

  revalidatePath(`/o/${orgId}/c/${channelId}`);
  return { sent: Date.now() };
}

// これより前の投稿。見える範囲は本人の権限で決まる
export async function loadOlder(channelId: string, before: string, limit: number) {
  const supabase = await createClient();
  return loadMessages(supabase, channelId, { before, limit: Math.min(limit, 100) });
}
