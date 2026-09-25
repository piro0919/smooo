import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

export type MessageItem = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  corrects: string | null;
  author: string;
  parent: { author: string; body: string } | null;
  // 本人にだけ見える原文。AI が書いた投稿ならその下書き
  source: { text: string; kind: string } | null;
  reactions: [emoji: string, names: string[]][];
  // この投稿について、AI が見ている本人に聞いていること。本人にしか見えない
  question: { id: string; prompt: string; options: string[]; deadline: string } | null;
};

// before より前の投稿を新しい順に limit 件取り、古い順に並べて返す。原文とリアクションも付ける。
// 見える範囲は呼んだ人の権限で決まる
export async function loadMessages(
  supabase: SupabaseClient<Database>,
  channelId: string,
  { before, limit }: { before?: string; limit: number },
): Promise<MessageItem[]> {
  let query = supabase
    .from("messages")
    .select(
      "id, body, created_at, author_id, corrects, profiles!messages_author_id_fkey(display_name), parent:reply_to(body, profiles!messages_author_id_fkey(display_name))",
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data: rows, error } = await query;
  if (error) throw error;

  const ids = (rows ?? []).map((m) => m.id);
  const [{ data: sources }, { data: reactions }, { data: questions }] = await Promise.all([
    supabase.from("message_sources").select("message_id, raw_text, kind").in("message_id", ids),
    supabase
      .from("reactions")
      .select("message_id, emoji, profiles(display_name)")
      .in("message_id", ids)
      .order("created_at"),
    supabase
      .from("questions")
      .select("id, message_id, prompt, options, deadline")
      .in("message_id", ids)
      .eq("status", "open"),
  ]);
  const questionById = new Map(
    (questions ?? []).map((q) => [
      q.message_id,
      {
        id: q.id,
        prompt: q.prompt,
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        deadline: q.deadline,
      },
    ]),
  );

  const sourceById = new Map((sources ?? []).map((s) => [s.message_id, { text: s.raw_text, kind: s.kind }]));
  const reactionsById = new Map<string, Map<string, string[]>>();
  for (const r of reactions ?? []) {
    const byEmoji = reactionsById.get(r.message_id) ?? new Map<string, string[]>();
    byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.profiles?.display_name ?? "?"]);
    reactionsById.set(r.message_id, byEmoji);
  }

  return (rows ?? []).reverse().map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    author_id: m.author_id,
    corrects: m.corrects,
    author: m.profiles?.display_name ?? "（不明）",
    parent: m.parent ? { author: m.parent.profiles?.display_name ?? "?", body: m.parent.body } : null,
    source: sourceById.get(m.id) ?? null,
    reactions: [...(reactionsById.get(m.id) ?? new Map())],
    question: questionById.get(m.id) ?? null,
  }));
}
