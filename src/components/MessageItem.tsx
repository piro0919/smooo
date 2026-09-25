import type { MessageItem as Item } from "@/lib/messages";
import { Avatar } from "./Avatar";
import { MessageActions } from "./MessageActions";
import { QuestionCard } from "./QuestionCard";

const time = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

// Slack と同じく、四角いアイコン、太字の名前、薄い時刻、本文の順。
// 自分の投稿にだけ、打った原文を開ける「原文」を付ける。AI が代わりに書いた投稿なら、その下書き。
// ほかの人には、AI が書いたかどうかは見せない
const deadline = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

export function MessageItem({ m, userId, orgId }: { m: Item; userId: string; orgId: string }) {
  return (
    <li
      tabIndex={0}
      className="group relative flex gap-2 px-4 py-2 outline-none hover:bg-zinc-50 focus:bg-zinc-50 md:px-5"
    >
      <MessageActions id={m.id} author={m.author} body={m.body} mine={m.author_id === userId} />
      <Avatar name={m.author} url={m.avatarUrl} />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-bold">{m.author}</span>
          <time dateTime={m.created_at} className="text-xs text-muted-foreground">
            {time.format(new Date(m.created_at))}
          </time>
        </p>
        {m.parent && (
          <p className="mb-1 truncate border-l-2 border-zinc-300 pl-2 text-xs text-muted-foreground">
            {m.corrects && <span className="mr-1 rounded bg-amber-100 px-1 font-bold text-amber-800">訂正</span>}
            {m.parent.author}: {m.parent.body}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
        {m.reactions.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {m.reactions.map(([emoji, names]) => (
              <li
                key={emoji}
                title={names.join("、")}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2 text-xs leading-6"
              >
                {emoji} {names.length}
              </li>
            ))}
          </ul>
        )}
        {m.question && (
          // AI が本人に聞いていること。聞かれた本人にしか届かないので、ほかの人には出ない
          <div className="mt-2 grid gap-2 rounded-lg border border-[#1164a3]/30 bg-[#1164a3]/5 p-3">
            <p className="text-xs text-muted-foreground">
              あなたの AI からの質問 ・ {deadline.format(new Date(m.question.deadline))} までに答えないと、AI
              が代わりに返します
            </p>
            <p className="text-sm font-bold">{m.question.prompt}</p>
            <QuestionCard orgId={orgId} questionId={m.question.id} options={m.question.options} />
          </div>
        )}
        {m.source && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">
              {m.source.kind === "ai" ? "あなたの AI が書きました" : "原文"}
            </summary>
            <p className="mt-1 whitespace-pre-wrap rounded bg-zinc-100 px-2 py-1">{m.source.text}</p>
          </details>
        )}
      </div>
    </li>
  );
}
