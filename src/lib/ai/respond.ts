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

export const EMOJI = ["👍", "🙏", "🎉", "👀", "✅", "😂"] as const;

const Respondents = z.object({
  respondents: z.array(z.object({ user_id: z.string(), reason: z.string() })),
  reactions: z.array(z.object({ user_id: z.string(), emoji: z.enum(EMOJI) })),
});

// 新しい投稿に、誰が返事をする必要があるか、誰がどのリアクションを付けるか。
// 返事は質問や依頼を向けられた人だけ。リアクションは返事をしない人が、自然なときだけ付ける。
// 同じ呼び出しで決めて、投稿1件あたりの呼び出しを増やさない
export async function whoMustRespond(input: {
  channel: string;
  recent: Line[];
  message: Line;
  members: { user_id: string; name: string }[];
}) {
  if (input.members.length === 0) return { respondents: [], reactions: [] };

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low", format: zodOutputFormat(Respondents) },
    system: `あなたはチャットツール Smooo の係です。チャンネルに新しい投稿が入りました。
参加者のうち、この投稿に返事をする必要がある人と、リアクションを付ける人を選びます。

返事（respondents）:
- 質問、依頼、確認、日程の打診など、答えや対応を求められている人だけを選ぶ
- 名前で呼ばれていれば、その人を選ぶ。「皆さん」のように全員に聞いていれば、全員を選ぶ
- ほかの人の投稿への返信なら、返信先の投稿を書いた人が相手。本文にほかの人の名前が出ていても、
  その人に向けた問いでなければ選ばない
- 報告、お礼、挨拶、相づちのように返事が要らない投稿なら、誰も選ばない

リアクション（reactions）:
- 返事をする人には付けない
- 職場のチャットで人が自然に付ける場面でだけ付ける。報告や共有に 👀 や ✅、お礼に 🙏、
  達成や良い知らせに 🎉、同意に 👍、冗談に 😂
- 自分に関係のない投稿や、付けると不自然な投稿には付けない。付けない人がいてよい
- 1人につき1つまで

投稿した本人は候補に入っていない`,
    messages: [
      {
        role: "user",
        content: `場所: ${input.channel}
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
  const respondents = (response.parsed_output?.respondents ?? []).filter((r) => known.has(r.user_id));
  const answering = new Set(respondents.map((r) => r.user_id));
  const seen = new Set<string>();
  const reactions = (response.parsed_output?.reactions ?? []).filter((r) => {
    if (!known.has(r.user_id) || answering.has(r.user_id) || seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });
  return { respondents, reactions };
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

export type Autonomy = "careful" | "standard" | "trusting";

// 本人が選んだ、聞かずに答えてよい範囲
const LIMITS: Record<Autonomy, string> = {
  careful: `答えてよいのは、「覚えていること」にこの問いへの答えがそのまま書いてあるときだけです。
少しでも解釈や推測が要るなら、本人に聞きます。`,
  standard: `答えてよいのは、「覚えていること」と会話から確実に言えることだけです。
本人の予定、意向、判断、新しい約束が要るのに、覚えていることから言えなければ、本人に聞きます。
推測で答えてはいけません。`,
  trusting: `「覚えていること」と会話から無理なく判断できるなら、本人に聞かずに答えます。
日程の調整や軽い依頼の引き受けのように、本人がふだん断らない種類のことは受けてかまいません。
お金、契約、人事、大きな約束のように重い判断が要るときと、手がかりが何もないときだけ本人に聞きます。`,
};

// 本人に代わって答えるか、本人に聞くか。どこまで答えるかは本人の設定に従う
export async function decide(input: {
  autonomy: Autonomy;
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

${LIMITS[input.autonomy]}

- 答えるなら action を answer にし、draft に${input.person}さんが雑に打つような短い返事を書く。
  丁寧に整えるのは別の係なので、ここでは整えない。question は空、options は空の配列、deadline_hours は 0
- 聞くなら action を ask にし、question に${input.person}さんへの短い質問を書く。
  options には、押すだけで答えられる選択肢を2〜4個入れる。「その他」は画面が付けるので入れない。
  deadline_hours には、投稿に期限があればそこまでの時間、なければ急ぎ具合から 1〜48 の範囲で入れる。
  draft には、確認していることを伝える短い一言を書く（例: 確認して返します）`,
    messages: [
      {
        role: "user",
        content: `場所: ${input.channel}

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
        content: `場所: ${input.channel}
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
        content: `場所: ${input.channel}

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

const Shareable = z.object({ scope: z.enum(["general", "internal"]), reason: z.string() });

// 社内のチャンネルで本人が答えた内容を、社外の人とのやり取りでも使ってよいか振り分ける。
// 迷ったら社内用。社外に漏れると困るものを general に入れる間違いのほうが重い
export async function classifyMemory(input: { question: string; answer: string }) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 512,
    output_config: { effort: "low", format: zodOutputFormat(Shareable) },
    system: `あなたはチャットツール Smooo で、AI が覚えた内容の置き場所を決める係です。
本人が社内のチャンネルで答えた内容を、社外の人とのやり取りでも使ってよいかを決めます。

- general: 本人自身についての、社外に伝わっても困らないこと。空いている時間帯、担当している役割、
  連絡のつきやすさなど
- internal: 会社の案件、取引先、金額、社内の判断や人事、社内の予定、ほかの社員のこと。
  迷うときもこちら`,
    messages: [{ role: "user", content: `質問: ${input.question}\n答え: ${input.answer}` }],
  });
  return response.parsed_output?.scope ?? "internal";
}

const Revision = z.object({
  remove_ids: z.array(z.string()),
  // 訂正で分かった、覚え直すこと。覚えることがなければ空
  add: z.string(),
});

// 本人が自分の投稿を訂正したら、覚えている内容のうち食い違うものを消し、訂正後の内容を覚え直す
export async function reviseMemories(input: {
  person: string;
  memories: { id: string; content: string }[];
  original: string;
  correction: string;
}) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(Revision) },
    system: `あなたはチャットツール Smooo で、${input.person}さんの AI が覚えている内容を管理する係です。
${input.person}さんが、自分の名前で出た投稿を訂正しました。

- 覚えている内容のうち、訂正と食い違うものの id を remove_ids に入れる。食い違わないものは残す
- 訂正から分かる、${input.person}さん自身についての事実を add に1文で書く。
  「〜への答え: 〜」の形に揃えなくてよい。覚えることがなければ空にする`,
    messages: [
      {
        role: "user",
        content: `覚えていること:
${input.memories.map((m) => `- [${m.id}] ${m.content}`).join("\n") || "（なし）"}

元の投稿: ${input.original}
訂正: ${input.correction}`,
      },
    ],
  });
  const known = new Set(input.memories.map((m) => m.id));
  const revision = response.parsed_output;
  return {
    removeIds: (revision?.remove_ids ?? []).filter((id) => known.has(id)),
    add: revision?.add.trim() ?? "",
  };
}
