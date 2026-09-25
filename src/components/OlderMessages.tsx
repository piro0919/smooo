"use client";

import { useState, useTransition } from "react";
import { loadOlder } from "@/app/o/[orgId]/c/[channelId]/actions";
import type { MessageItem as Item } from "@/lib/messages";
import { MessageItem } from "./MessageItem";

const PAGE = 50;

// 一覧の先頭に置く。押すと、いま出ているいちばん古い投稿より前を読み込んで上に足す。
// 一覧は下から積んでいるので、上に足しても見ている位置は動かない
export function OlderMessages({
  channelId,
  oldest,
  userId,
  orgId,
}: {
  channelId: string;
  oldest: string;
  userId: string;
  orgId: string;
}) {
  const [older, setOlder] = useState<Item[]>([]);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const before = older[0]?.created_at ?? oldest;

  return (
    <>
      {!done && (
        <li className="flex justify-center py-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-zinc-100"
            onClick={() =>
              start(async () => {
                const page = await loadOlder(channelId, before, PAGE);
                setOlder((o) => [...page, ...o]);
                if (page.length < PAGE) setDone(true);
              })
            }
          >
            {pending ? "読み込んでいます…" : "これより前の投稿を読み込む"}
          </button>
        </li>
      )}
      {older.map((m) => (
        <MessageItem key={m.id} m={m} userId={userId} orgId={orgId} />
      ))}
    </>
  );
}
