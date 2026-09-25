"use client";

import { Pencil, Reply } from "lucide-react";
import { useComposerTarget } from "./ComposerTarget";

// 投稿にカーソルを合わせると出る。自分の名前の投稿なら訂正もできる
export function MessageActions({
  id,
  author,
  body,
  mine,
}: {
  id: string;
  author: string;
  body: string;
  mine: boolean;
}) {
  const { setTarget } = useComposerTarget();
  const button =
    "flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-zinc-100 hover:text-foreground";

  return (
    <div className="absolute right-4 top-1 hidden gap-1 rounded-md border bg-white p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
      <button type="button" className={button} onClick={() => setTarget({ id, kind: "reply", author, body })}>
        <Reply className="size-3.5" />
        返信
      </button>
      {mine && (
        <button type="button" className={button} onClick={() => setTarget({ id, kind: "correct", author, body })}>
          <Pencil className="size-3.5" />
          訂正
        </button>
      )}
    </div>
  );
}
