import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// 指示文は evals/format/run.py と同じファイルを読む。直したら evals で回し直す
const SYSTEM = readFileSync(path.join(process.cwd(), "src/lib/ai/format-system.md"), "utf8");

// 2026-09-26 に evals/format で Haiku 4.5 と比べて決めた
const MODEL = "claude-sonnet-5";

const client = new Anthropic();

// 本文を JSON の message 欄で受け取る。欄の外に独り言が出ても本文に混ざらない。
// 素の文字列で受けていたときは、「上司(社内)への文面です。」のような独り言が本文に混ざった
const Message = z.object({ message: z.string() });

export type Audience = "internal" | "external";

export type Person = { name: string; outside: boolean };

// evals/format/cases_mixed.json の scope と同じ文。直したら両方そろえる
export function mixedAudience(inside: string[], outside: string[]) {
  return `。同じ会社: ${inside.join("、") || "なし"}。社外: ${outside.join("、") || "なし"}。
入力が同じ会社の人に呼びかけているなら「様」や「お世話になっております」を使わず、「さん」付けの社内の丁寧語で書く。
社外の人に呼びかけているか、誰にも呼びかけていなければ、社外向けに書く。入力に呼びかけがなければ宛名を足さない`;
}

// 雑に打たれた文章を、チャンネルの参加者に送る丁寧な文面にする。
// 社外の人もいるチャンネルでは、誰が同じ会社で誰が社外かを渡し、宛先に合わせて書き分けさせる
export async function formatMessage(
  raw: string,
  channel: { name: string | null; audience: Audience },
  people: Person[] = [],
  // DM なら相手の名前
  dmWith?: string,
) {
  const inside = people.filter((p) => !p.outside).map((p) => p.name);
  const outside = people.filter((p) => p.outside).map((p) => p.name);
  // 書き分けの指示は、社外の人がいるときだけ相手欄に添える。指示文そのものに足すと、
  // 社内の投稿でも宛名を考え込み、考えたことを本文に書き出した（evals/format/results_v4_unseen.md の #12）
  const to = dmWith
    ? `${dmWith}さん（社内。1対1のメッセージ）`
    : channel.audience === "external"
      ? `#${channel.name} の参加者（社外の人を含む${people.length ? mixedAudience(inside, outside) : ""}）`
      : `#${channel.name} の参加者（社内）`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(Message) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `相手: ${to}\n入力: ${raw}` }],
  });

  const text = response.parsed_output?.message.trim();
  if (!text || response.stop_reason !== "end_turn") {
    throw new Error(`formatting stopped: ${response.stop_reason}`);
  }
  return text;
}
