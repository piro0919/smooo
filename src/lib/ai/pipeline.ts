import "server-only";
import { formatMessage, type Audience } from "./format";
import { decide, draftFromAnswer, draftWithoutAnswer, whoMustRespond, type Autonomy, type Line } from "./respond";
import { createAdminClient } from "@/lib/supabase/admin";

const RECENT = 20;

type Channel = { id: string; name: string; audience: Audience; organization_id: string };

async function loadChannel(channelId: string): Promise<Channel> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("channels")
    .select("id, name, audience, organization_id")
    .eq("id", channelId)
    .single();
  if (error) throw error;
  return { ...data, audience: data.audience === "external" ? "external" : "internal" };
}

// 直近の会話。古い順に並べる
async function loadRecent(channelId: string, before: string): Promise<Line[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("messages")
    .select("body, profiles(display_name)")
    .eq("channel_id", channelId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(RECENT);
  return (data ?? []).reverse().map((m) => ({ author: m.profiles?.display_name ?? "?", body: m.body }));
}

// その人が、このチャンネルで使ってよい記憶。社内で覚えたものは社内のチャンネルでだけ使い、
// 社外も入るチャンネルで覚えたものは、そのチャンネルでだけ使う
async function loadMemories(userId: string, channel: Channel) {
  const admin = createAdminClient();
  let query = admin.from("memories").select("content").eq("user_id", userId);
  query =
    channel.audience === "internal"
      ? query.eq("organization_id", channel.organization_id).eq("scope", "internal")
      : query.eq("scope", "channel").eq("channel_id", channel.id);
  const { data } = await query.order("created_at").limit(200);
  return (data ?? []).map((m) => m.content);
}

// 本人の名前で投稿する。下書きを整形係に通してから出し、下書きは本人にだけ見える形で残す
async function postAs(userId: string, channel: Channel, draft: string, replyTo: string) {
  const admin = createAdminClient();
  const body = await formatMessage(draft, channel);
  const { data: message, error } = await admin
    .from("messages")
    .insert({ channel_id: channel.id, author_id: userId, body, reply_to: replyTo, origin: "ai" })
    .select("id")
    .single();
  if (error) throw error;
  await admin
    .from("message_sources")
    .insert({ message_id: message.id, author_id: userId, raw_text: draft, kind: "ai" });
}

// 人間の投稿が入ったら、返事を求められた人ごとに、その人の AI が答えるか本人に聞く。
// AI の投稿には反応しない。AI 同士の往復が止まらなくなるのを防ぐため
export async function respondToMessage(messageId: string) {
  const admin = createAdminClient();
  const { data: message } = await admin
    .from("messages")
    .select("id, channel_id, author_id, body, origin, created_at, profiles(display_name)")
    .eq("id", messageId)
    .single();
  if (!message || message.origin !== "human") return;

  const channel = await loadChannel(message.channel_id);
  const recent = await loadRecent(channel.id, message.created_at);
  const trigger: Line = { author: message.profiles?.display_name ?? "?", body: message.body };

  const { data: members } = await admin
    .from("channel_members")
    .select("user_id, profiles(display_name, autonomy)")
    .eq("channel_id", channel.id)
    .neq("user_id", message.author_id);
  const people = (members ?? []).map((m) => ({
    user_id: m.user_id,
    name: m.profiles?.display_name ?? "?",
    autonomy: (m.profiles?.autonomy ?? "standard") as Autonomy,
  }));

  const respondents = await whoMustRespond({
    channel: channel.name,
    recent,
    message: trigger,
    members: people.map(({ user_id, name }) => ({ user_id, name })),
  });

  await Promise.all(
    respondents.map(async ({ user_id }) => {
      const { name: person, autonomy } = people.find((p) => p.user_id === user_id)!;
      const decision = await decide({
        autonomy,
        person,
        channel: channel.name,
        recent,
        message: trigger,
        memories: await loadMemories(user_id, channel),
      });

      if (decision.action === "ask") {
        const hours = Math.min(48, Math.max(1, decision.deadline_hours || 24));
        await admin.from("questions").insert({
          user_id,
          message_id: message.id,
          channel_id: channel.id,
          prompt: decision.question,
          options: decision.options.slice(0, 4),
          deadline: new Date(Date.now() + hours * 3600_000).toISOString(),
        });
      }
      // 答えられるなら答えを、聞くなら「確認します」の一言を、本人の名前で返す
      if (decision.draft.trim()) await postAs(user_id, channel, decision.draft, message.id);
    }),
  );
}

// 本人が質問に答えたら、答えを覚え、その答えで返事をする
export async function respondWithAnswer(questionId: string) {
  const admin = createAdminClient();
  const { data: q } = await admin
    .from("questions")
    .select("id, user_id, prompt, answer, channel_id, message_id, messages(body, profiles(display_name)), profiles(display_name)")
    .eq("id", questionId)
    .single();
  if (!q || !q.answer) return;

  const channel = await loadChannel(q.channel_id);
  await admin.from("memories").insert({
    user_id: q.user_id,
    organization_id: channel.organization_id,
    scope: channel.audience === "internal" ? "internal" : "channel",
    channel_id: channel.audience === "internal" ? null : channel.id,
    content: `「${q.prompt}」への答え: ${q.answer}`,
  });

  const draft = await draftFromAnswer({
    person: q.profiles?.display_name ?? "?",
    channel: channel.name,
    message: {
      author: q.messages?.profiles?.display_name ?? "?",
      body: q.messages?.body ?? "",
    },
    question: q.prompt,
    answer: q.answer,
  });
  await postAs(q.user_id, channel, draft, q.message_id);
}

// 期限を過ぎた質問に、本人の AI が代わりに返す。推測で返したことは記憶に残さない。
// 同じ質問を二度処理しないよう、open から expired に変えられたものだけを扱う
export async function answerOverdueQuestions() {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("questions")
    .update({ status: "expired" })
    .eq("status", "open")
    .lt("deadline", new Date().toISOString())
    .select("id, user_id, prompt, channel_id, message_id, profiles(display_name), messages(body, created_at, profiles(display_name))");

  const results = await Promise.allSettled(
    (due ?? []).map(async (q) => {
      const channel = await loadChannel(q.channel_id);
      const draft = await draftWithoutAnswer({
        person: q.profiles?.display_name ?? "?",
        channel: channel.name,
        recent: await loadRecent(channel.id, q.messages?.created_at ?? new Date().toISOString()),
        message: {
          author: q.messages?.profiles?.display_name ?? "?",
          body: q.messages?.body ?? "",
        },
        question: q.prompt,
        memories: await loadMemories(q.user_id, channel),
      });
      await postAs(q.user_id, channel, draft, q.message_id);
    }),
  );

  for (const r of results) if (r.status === "rejected") console.error("answerOverdueQuestions", r.reason);
  return { handled: results.length, failed: results.filter((r) => r.status === "rejected").length };
}
