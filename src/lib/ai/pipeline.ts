import "server-only";
import { formatMessage, type Audience, type Person } from "./format";
import {
  classifyMemory,
  decide,
  draftFromAnswer,
  draftWithoutAnswer,
  whoMustRespond,
  type Autonomy,
  type Line,
} from "./respond";
import { createAdminClient } from "@/lib/supabase/admin";

const RECENT = 20;

type Channel = {
  id: string;
  name: string | null;
  kind: string;
  audience: Audience;
  organization_id: string;
  // プロンプトに書く場所の名前。チャンネルは #名前、DM は「DM」
  label: string;
};

export async function loadChannel(channelId: string): Promise<Channel> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("channels")
    .select("id, name, kind, audience, organization_id")
    .eq("id", channelId)
    .single();
  if (error) throw error;
  return {
    ...data,
    audience: data.audience === "external" ? "external" : "internal",
    label: data.kind === "dm" ? "1対1の DM" : `#${data.name}`,
  };
}

// 直近の会話。古い順に並べる
async function loadRecent(channelId: string, before: string): Promise<Line[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("messages")
    .select("body, profiles!messages_author_id_fkey(display_name)")
    .eq("channel_id", channelId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(RECENT);
  return (data ?? []).reverse().map((m) => ({ author: m.profiles?.display_name ?? "?", body: m.body }));
}

// その人が、このチャンネルで使ってよい記憶。社内で覚えたものは社内のチャンネルでだけ使い、
// 社外も入るチャンネルで覚えたものは、そのチャンネルでだけ使う。general はどこでも使う
async function loadMemories(userId: string, channel: Channel) {
  const admin = createAdminClient();
  const here =
    channel.audience === "internal"
      ? `and(scope.eq.internal,organization_id.eq.${channel.organization_id})`
      : `and(scope.eq.channel,channel_id.eq.${channel.id})`;
  const { data, error } = await admin
    .from("memories")
    .select("content")
    .eq("user_id", userId)
    .or(`scope.eq.general,${here}`)
    .order("created_at")
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((m) => m.content);
}

// チャンネルのほかの参加者が、書く人から見て同じ会社か社外か。所属する Organization が一つでも重なれば同じ会社
export async function peopleFor(authorId: string, channelId: string): Promise<Person[]> {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("channel_members")
    .select("user_id, profiles(display_name)")
    .eq("channel_id", channelId)
    .neq("user_id", authorId);
  const ids = [authorId, ...(members ?? []).map((m) => m.user_id)];
  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id, organization_id")
    .in("user_id", ids);
  const orgsOf = (id: string) =>
    new Set((memberships ?? []).filter((m) => m.user_id === id).map((m) => m.organization_id));
  const mine = orgsOf(authorId);
  return (members ?? []).map((m) => ({
    name: m.profiles?.display_name ?? "?",
    outside: ![...orgsOf(m.user_id)].some((o) => mine.has(o)),
  }));
}

// 書く人から見た宛先を添えて整形する。DM なら相手の名前、社外もいるチャンネルなら内訳
export async function formatFor(authorId: string, channel: Channel, raw: string) {
  if (channel.kind === "dm") {
    const [other] = await peopleFor(authorId, channel.id);
    return formatMessage(raw, channel, [], other?.name);
  }
  return formatMessage(
    raw,
    channel,
    channel.audience === "external" ? await peopleFor(authorId, channel.id) : [],
  );
}

// 本人の名前で投稿する。下書きを整形係に通してから出し、下書きは本人にだけ見える形で残す
async function postAs(userId: string, channel: Channel, draft: string, replyTo: string) {
  const admin = createAdminClient();
  const body = await formatFor(userId, channel, draft);
  const { data: message, error } = await admin
    .from("messages")
    .insert({ channel_id: channel.id, author_id: userId, body, reply_to: replyTo, origin: "ai" })
    .select("id")
    .single();
  if (error) throw error;
  const { error: sourceError } = await admin
    .from("message_sources")
    .insert({ message_id: message.id, author_id: userId, raw_text: draft, kind: "ai" });
  if (sourceError) throw sourceError;
}

// 人間の投稿が入ったら、返事を求められた人ごとに、その人の AI が答えるか本人に聞く。
// AI の投稿には反応しない。AI 同士の往復が止まらなくなるのを防ぐため
export async function respondToMessage(messageId: string) {
  const admin = createAdminClient();
  const { data: message, error: messageError } = await admin
    .from("messages")
    .select("id, channel_id, author_id, body, origin, created_at, profiles!messages_author_id_fkey(display_name)")
    .eq("id", messageId)
    .single();
  // 問い合わせの失敗を「対象外」と取り違えない。あいまいな結合で黙って止まったことがある
  if (messageError) throw messageError;
  if (message.origin !== "human") return;

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

  const { respondents, reactions } = await whoMustRespond({
    channel: channel.label,
    recent,
    message: trigger,
    members: people.map(({ user_id, name }) => ({ user_id, name })),
  });

  console.info("respondToMessage", message.id, {
    respondents: respondents.map((r) => r.user_id),
    reactions: reactions.map((r) => r.emoji),
  });

  if (reactions.length) {
    const { error } = await admin.from("reactions").insert(
      reactions.map((r) => ({ message_id: message.id, channel_id: channel.id, user_id: r.user_id, emoji: r.emoji })),
    );
    if (error) throw error;
  }

  await Promise.all(
    respondents.map(async ({ user_id }) => {
      const { name: person, autonomy } = people.find((p) => p.user_id === user_id)!;
      const decision = await decide({
        autonomy,
        person,
        channel: channel.label,
        recent,
        message: trigger,
        memories: await loadMemories(user_id, channel),
      });

      if (decision.action === "ask") {
        const hours = Math.min(48, Math.max(1, decision.deadline_hours || 24));
        const { error } = await admin.from("questions").insert({
          user_id,
          message_id: message.id,
          channel_id: channel.id,
          prompt: decision.question,
          options: decision.options.slice(0, 4),
          deadline: new Date(Date.now() + hours * 3600_000).toISOString(),
        });
        if (error) throw error;
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
    .select("id, user_id, prompt, answer, channel_id, message_id, messages(body, profiles!messages_author_id_fkey(display_name)), profiles(display_name)")
    .eq("id", questionId)
    .single();
  if (!q || !q.answer) return;

  const channel = await loadChannel(q.channel_id);
  const content = `「${q.prompt}」への答え: ${q.answer}`;
  // 社外とのチャンネルで覚えたことは、そのチャンネル専用。社内で覚えたことは、
  // 社外に伝わっても困らないものだけ、どの相手にも使ってよい記憶にする
  const memory =
    channel.audience === "external"
      ? { scope: "channel", organization_id: channel.organization_id, channel_id: channel.id }
      : (await classifyMemory({ question: q.prompt, answer: q.answer })) === "general"
        ? { scope: "general", organization_id: null, channel_id: null }
        : { scope: "internal", organization_id: channel.organization_id, channel_id: null };
  const { error: memoryError } = await admin
    .from("memories")
    .insert({ user_id: q.user_id, content, ...memory });
  if (memoryError) throw memoryError;

  const draft = await draftFromAnswer({
    person: q.profiles?.display_name ?? "?",
    channel: channel.label,
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
    .select("id, user_id, prompt, channel_id, message_id, profiles(display_name), messages(body, created_at, profiles!messages_author_id_fkey(display_name))");

  const results = await Promise.allSettled(
    (due ?? []).map(async (q) => {
      const channel = await loadChannel(q.channel_id);
      const draft = await draftWithoutAnswer({
        person: q.profiles?.display_name ?? "?",
        channel: channel.label,
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
