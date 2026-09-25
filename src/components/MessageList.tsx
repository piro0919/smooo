import { MessageActions } from "./MessageActions";

type Message = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  corrects: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
  parent: { body: string; profiles: { display_name: string } | null } | null;
};

const time = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

// Slack と同じく、四角いアイコン、太字の名前、薄い時刻、本文の順。
// 自分の投稿にだけ、打った原文を開ける「原文」を付ける。AI が代わりに書いた投稿なら、その下書き。
// ほかの人には、AI が書いたかどうかは見せない
export function MessageList({
  messages,
  sources,
  reactions,
  userId,
}: {
  messages: Message[];
  sources: Map<string, { text: string; kind: string }>;
  reactions: Map<string, Map<string, string[]>>;
  userId: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
        まだ投稿はありません。
      </div>
    );
  }

  return (
    // 下から積む。新しい投稿が来ても、いちばん下が見えたままになる
    <div className="flex flex-1 flex-col-reverse overflow-y-auto py-4">
      <ol>
        {messages.map((m) => {
          const name = m.profiles?.display_name ?? "（不明）";
          const source = sources.get(m.id);
          return (
            <li key={m.id} tabIndex={0} className="group relative flex gap-2 px-4 py-2 outline-none hover:bg-zinc-50 focus:bg-zinc-50 md:px-5">
              <MessageActions id={m.id} author={name} body={m.body} mine={m.author_id === userId} />
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#4a154b] text-sm font-bold text-white">
                {name.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className="font-bold">{name}</span>
                  <time dateTime={m.created_at} className="text-xs text-muted-foreground">
                    {time.format(new Date(m.created_at))}
                  </time>
                </p>
                {m.parent && (
                  <p className="mb-1 truncate border-l-2 border-zinc-300 pl-2 text-xs text-muted-foreground">
                    {m.corrects && (
                      <span className="mr-1 rounded bg-amber-100 px-1 font-bold text-amber-800">訂正</span>
                    )}
                    {m.parent.profiles?.display_name}: {m.parent.body}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
                {reactions.get(m.id) && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {[...reactions.get(m.id)!].map(([emoji, names]) => (
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
                {source && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      {source.kind === "ai" ? "あなたの AI が書きました" : "原文"}
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap rounded bg-zinc-100 px-2 py-1">{source.text}</p>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
