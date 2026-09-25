import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// 指示文は evals/format/run.py と同じファイルを読む。直したら evals で回し直す
const SYSTEM = readFileSync(path.join(process.cwd(), "src/lib/ai/format-system.md"), "utf8");

// 2026-09-26 に evals/format で Haiku 4.5 と比べて決めた
const MODEL = "claude-sonnet-5";

const client = new Anthropic();

export type Audience = "internal" | "external";

// 雑に打たれた文章を、チャンネルの参加者に送る丁寧な文面にする
export async function formatMessage(raw: string, channel: { name: string; audience: Audience }) {
  const to =
    channel.audience === "external"
      ? `#${channel.name} の参加者（社外の人を含む）`
      : `#${channel.name} の参加者（社内）`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `相手: ${to}\n入力: ${raw}` }],
  });

  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();

  if (!text || response.stop_reason !== "end_turn") {
    throw new Error(`formatting stopped: ${response.stop_reason}`);
  }
  return text;
}
