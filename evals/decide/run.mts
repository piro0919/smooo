// AI が本人に聞かずに答えるか、本人に聞くかの判断を、設定の3段階ごとに測る。
//   ANTHROPIC_API_KEY=... npx tsx --conditions react-server evals/decide/run.mts [runs]
// cases.json の expect が正解。results.md に書き出す
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decide, type Autonomy } from "../../src/lib/ai/respond";

const here = path.dirname(fileURLToPath(import.meta.url));
type Case = { id: number; memories: string[]; author: string; body: string; expect: Record<Autonomy, string> };
const cases: Case[] = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));
const levels: Autonomy[] = ["careful", "standard", "trusting"];
const runs = Number(process.argv[2] ?? 3);

const jobs = cases.flatMap((c) => levels.flatMap((level) => Array.from({ length: runs }, () => ({ c, level }))));
const results: { c: Case; level: Autonomy; got: string; draft: string }[] = [];
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const d = await decide({
        autonomy: job.level,
        person: "佐藤",
        channel: "#client-x",
        recent: [],
        message: { author: job.c.author, body: job.c.body },
        memories: job.c.memories,
      });
      results.push({ ...job, got: d.action, draft: d.action === "answer" ? d.draft : d.question });
    }
  }),
);

const lines = ["| # | Post | Memory | careful | standard | trusting |", "| --- | --- | --- | --- | --- | --- |"];
const score: Record<string, [number, number]> = { careful: [0, 0], standard: [0, 0], trusting: [0, 0] };
for (const c of cases) {
  const cells = levels.map((level) => {
    const rs = results.filter((r) => r.c.id === c.id && r.level === level);
    const ok = rs.filter((r) => r.got === c.expect[level]).length;
    score[level][0] += ok;
    score[level][1] += rs.length;
    const mark = ok === rs.length ? "" : " ✗";
    return `${c.expect[level]} ${ok}/${rs.length}${mark}`;
  });
  lines.push(`| ${c.id} | ${c.body} | ${c.memories.join("、") || "-"} | ${cells.join(" | ")} |`);
}
lines.push("");
for (const level of levels) lines.push(`- ${level}: ${score[level][0]}/${score[level][1]}`);
lines.push("", "Misses:", "");
for (const r of results.filter((r) => r.got !== r.c.expect[r.level])) {
  lines.push(`- #${r.c.id} ${r.level}: expected ${r.c.expect[r.level]}, got ${r.got} — ${r.draft.replace(/\n/g, " ")}`);
}
writeFileSync(path.join(here, "results.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
