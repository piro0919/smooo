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

SYSTEM = """あなたはチャットツール Smooo の整形係です。
利用者が雑に打った文章を、送信者本人の発言として、相手に送る丁寧な日本語の文面に書き直します。

守ること:
- 意味と事実を変えない。日付、時刻、金額、数値、URL、固有名詞はそのまま残す
- 元の文にない事実、約束、理由、謝罪、提案を足さない。特に「改めてご連絡します」「ご案内いたします」のような、送信者がこれから何かをする約束は、元の文に書かれていない限り絶対に書かない
- 期限や条件を作らない。「3日待っている」は過去の経過であって、「3日以内に」という期限ではない
- 「了解」「OK」「👍」のような短い返事は、短い承諾の返事にする。感謝や確認など別の意味を作らない
- 「それ以外は不要」「〜だけ」「何度も伝えている」のような限定や強調は、丁寧な言い方に変えて必ず残す
- 断り、指摘、催促、反対意見などの本題はぼかさずに伝える。角だけ取る。反対意見を質問や依頼に変えない
- 口調は丁寧語で揃える。社外の相手にはもう一段かしこまる
- 「お疲れ様です」は社内の相手にだけ使う。社外の相手には使わず、必要なら「お世話になっております」を使う
- 長くしすぎない。元の文の用件が一つなら、文面も短くまとめる。定型の挨拶や結びを毎回付けない
- 書き直した文面だけを出力する。前置きや説明は付けない"""

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

    lines = ["| # | 相手 | 入力 | Haiku 4.5 | Sonnet 5 |", "| --- | --- | --- | --- | --- |"]
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
            f"- {k}: 平均 入力{sum(r['in'] for r in rs) / n:.0f} / 出力{sum(r['out'] for r in rs) / n:.0f} トークン、"
            f"1件 {sum(r['cost'] for r in rs) / n:.5f} ドル"
        )
    (HERE / OUT).write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
