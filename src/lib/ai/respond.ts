import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// 判断は整形と同じ Sonnet 5。Jev の新規登録が再開したら、答えてよいかの判定だけ移す
const MODEL = "claude-sonnet-5";
const client = new Anthropic();

export type Line = { author: string; body: string };

function transcript(lines: Line[]) {
  return lines.map((l) => `${l.author}: ${l.body}`).join("\n");
}

const Respondents = z.object({
  respondents: z.array(z.object({ user_id: z.string(), reason: z.string() })),
});

// 新しい投稿に、誰が返事をする必要があるか。質問や依頼を向けられた人だけを選ぶ。
// 挨拶、報告、お礼のように返事が要らない投稿なら、誰も選ばない
export async function whoMustRespond(input: {
  channel: string;
  recent: Line[];
  message: Line;
  members: { user_id: string; name: string }[];
}) {
  if (input.members.length === 0) return [];

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low", format: zodOutputFormat(Respondents) },
    system: `あなたはチャットツール Smooo の係です。チャンネルに新しい投稿が入りました。
参加者のうち、この投稿に返事をする必要がある人を選びます。

- 質問、依頼、確認、日程の打診など、答えや対応を求められている人だけを選ぶ
- 名前で呼ばれていれば、その人を選ぶ。「皆さん」のように全員に聞いていれば、全員を選ぶ
- 報告、お礼、挨拶、相づちのように返事が要らない投稿なら、誰も選ばない
- 投稿した本人は候補に入っていない`,
    messages: [
      {
        role: "user",
        content: `チャンネル: #${input.channel}
参加者:
${input.members.map((m) => `- ${m.user_id}: ${m.name}`).join("\n")}

これまでの会話:
${transcript(input.recent) || "（なし）"}

新しい投稿:
${input.message.author}: ${input.message.body}`,
      },
    ],
  });

  const known = new Set(input.members.map((m) => m.user_id));
  return (response.parsed_output?.respondents ?? []).filter((r) => known.has(r.user_id));
}

const Decision = z.object({
  action: z.enum(["answer", "ask"]),
  // answer のとき。本人が雑に打つような短い下書き。整形は別で行う
  draft: z.string(),
  // ask のとき。本人への質問と、押すだけで答えられる選択肢
  question: z.string(),
  options: z.array(z.string()),
  // ask のとき。本文に期限があればそれまで、なければ急ぎ具合から決める
  deadline_hours: z.number(),
});

// 本人に代わって答えるか、本人に聞くか。覚えていることと会話から確実に言えることだけで答える
export async function decide(input: {
  person: string;
  channel: string;
  recent: Line[];
  message: Line;
  memories: string[];
}) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "medium", format: zodOutputFormat(Decision) },
    system: `あなたはチャットツール Smooo で、${input.person}さんの代わりに返事をする係です。
${input.person}さんに向けられた投稿に、本人に聞かずに答えられるかを決めます。

答えてよいのは、「${input.person}さんについて覚えていること」と会話から確実に言えることだけです。
本人の予定、意向、判断、新しい約束が要るのに、覚えていることから言えなければ、本人に聞きます。
推測で答えてはいけません。

- 答えるなら action を answer にし、draft に${input.person}さんが雑に打つような短い返事を書く。
  丁寧に整えるのは別の係なので、ここでは整えない。question は空、options は空の配列、deadline_hours は 0
- 聞くなら action を ask にし、question に${input.person}さんへの短い質問を書く。
  options には、押すだけで答えられる選択肢を2〜4個入れる。「その他」は画面が付けるので入れない。
  deadline_hours には、投稿に期限があればそこまでの時間、なければ急ぎ具合から 1〜48 の範囲で入れる。
  draft には、確認していることを伝える短い一言を書く（例: 確認して返します）`,
    messages: [
      {
        role: "user",
        content: `チャンネル: #${input.channel}

${input.person}さんについて覚えていること:
${input.memories.map((m) => `- ${m}`).join("\n") || "（なし）"}

これまでの会話:
${transcript(input.recent) || "（なし）"}

${input.person}さんに向けられた投稿:
${input.message.author}: ${input.message.body}`,
      },
    ],
  });

  const decision = response.parsed_output;
  if (!decision) throw new Error(`decision failed: ${response.stop_reason}`);
  return decision;
}

const Draft = z.object({ draft: z.string() });

// 本人が質問に答えたら、その答えをもとに返事の下書きを作る
export async function draftFromAnswer(input: {
  person: string;
  channel: string;
  message: Line;
  question: string;
  answer: string;
}) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(Draft) },
    system: `あなたはチャットツール Smooo で、${input.person}さんの代わりに返事をする係です。
${input.person}さんに確認した答えをもとに、投稿への返事の下書きを書きます。
${input.person}さんが雑に打つような短い文にします。丁寧に整えるのは別の係です。
答えにないことは足しません。`,
    messages: [
      {
        role: "user",
        content: `チャンネル: #${input.channel}
返事をする投稿:
${input.message.author}: ${input.message.body}

${input.person}さんへの質問: ${input.question}
${input.person}さんの答え: ${input.answer}`,
      },
    ],
  });

  const draft = response.parsed_output?.draft.trim();
  if (!draft) throw new Error(`draft failed: ${response.stop_reason}`);
  return draft;
}

// 期限までに本人が答えなかったとき、AI が代わりに返す下書き。
// 話が止まらないよう、前向きに受けて進める。結果の責任は答えなかった本人が負う
export async function draftWithoutAnswer(input: {
  person: string;
  channel: string;
  recent: Line[];
  message: Line;
  question: string;
  memories: string[];
}) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(Draft) },
    system: `あなたはチャットツール Smooo で、${input.person}さんの代わりに返事をする係です。
${input.person}さんに確認しましたが、期限までに答えがありませんでした。
話を止めないよう、${input.person}さんとして前向きに受けて、話を進める返事の下書きを書きます。

- 断らずに受ける。条件や代案を足すより、相手の提案に沿って進める
- 約束を含めてよい
- 「AI が代わりに」「確認できなかったので」のような断りは書かない。本人の返事として書く
- ${input.person}さんが雑に打つような短い文にする。丁寧に整えるのは別の係`,
    messages: [
      {
        role: "user",
        content: `チャンネル: #${input.channel}

${input.person}さんについて覚えていること:
${input.memories.map((m) => `- ${m}`).join("\n") || "（なし）"}

これまでの会話:
${transcript(input.recent) || "（なし）"}

返事をする投稿:
${input.message.author}: ${input.message.body}

${input.person}さんに聞いていたこと: ${input.question}`,
      },
    ],
  });

  const draft = response.parsed_output?.draft.trim();
  if (!draft) throw new Error(`draft failed: ${response.stop_reason}`);
  return draft;
}
