"""Smooo: 雑な入力を丁寧な文面に整形させ、Haiku 4.5 と Sonnet 5 を並べる。

使い方:
  python3 -m venv .venv && .venv/bin/pip install anthropic
  ANTHROPIC_API_KEY=... .venv/bin/python run.py [cases.json] [results.md]

results_v1.md は SYSTEM を直す前の結果。v2 と v3_unseen が今の SYSTEM での結果で、
v3_unseen は SYSTEM を書くときに見ていない cases2.json を使っている。
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import anthropic

HERE = Path(__file__).parent

# 本番と同じ指示文を読む
SYSTEM = (HERE.parent.parent / "src/lib/ai/format-system.md").read_text()

MODELS = {
    "haiku": {"model": "claude-haiku-4-5", "extra": {}, "price": (1.0, 5.0)},
    "sonnet": {"model": "claude-sonnet-5", "extra": {"output_config": {"effort": "low"}}, "price": (2.0, 10.0)},
}

client = anthropic.Anthropic()
CASES, OUT = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("cases.json", "results.md")


def rewrite(key: str, case: dict) -> dict:
    spec = MODELS[key]
    user = f"相手: {case['to']}（{case['scope']}）\n入力: {case['raw']}"
    resp = client.messages.create(
        model=spec["model"],
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
        **spec["extra"],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    pin, pout = spec["price"]
    cost = (resp.usage.input_tokens * pin + resp.usage.output_tokens * pout) / 1_000_000
    return {"text": text, "in": resp.usage.input_tokens, "out": resp.usage.output_tokens, "cost": cost}


def main() -> None:
    cases = json.loads((HERE / CASES).read_text())
    jobs = [(k, c) for c in cases for k in MODELS]
    with ThreadPoolExecutor(max_workers=6) as pool:
        outs = list(pool.map(lambda kc: rewrite(*kc), jobs))
    results = {(k, c["id"]): o for (k, c), o in zip(jobs, outs)}

    def cell(s: str) -> str:
        return s.replace("|", "\\|").replace("\n", "<br>")

    lines = ["| # | To | Input | Haiku 4.5 | Sonnet 5 |", "| --- | --- | --- | --- | --- |"]
    for c in cases:
        h, s = results[("haiku", c["id"])], results[("sonnet", c["id"])]
        lines.append(
            f"| {c['id']} | {c['to']}（{c['scope']}） | {cell(c['raw'])} | {cell(h['text'])} | {cell(s['text'])} |"
        )
    lines.append("")
    for k in MODELS:
        rs = [results[(k, c["id"])] for c in cases]
        n = len(rs)
        lines.append(
            f"- {k}: avg input {sum(r['in'] for r in rs) / n:.0f} / output {sum(r['out'] for r in rs) / n:.0f} tokens, "
            f"${sum(r['cost'] for r in rs) / n:.5f} per message"
        )
    (HERE / OUT).write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
