"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendHorizontal } from "lucide-react";
import { postMessage, type PostState } from "@/app/o/[orgId]/c/[channelId]/actions";

// Slack と同じく Enter で送信、Shift+Enter で改行。日本語の変換中の Enter では送らない
export function Composer({
  orgId,
  channelId,
  channelName,
}: {
  orgId: string;
  channelId: string;
  channelName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState<PostState, FormData>(
    postMessage.bind(null, orgId, channelId),
    {},
  );

  useEffect(() => {
    if (!state.sent || !textRef.current) return;
    textRef.current.value = "";
    textRef.current.focus();
  }, [state.sent]);

  return (
    <form ref={formRef} action={action} className="px-5 pb-5">
      <div className="rounded-lg border border-zinc-300 focus-within:border-zinc-500">
        <textarea
          ref={textRef}
          name="raw"
          rows={3}
          key={state.raw ?? "composer"}
          defaultValue={state.raw}
          placeholder={`#${channelName} へ。雑に打って大丈夫です`}
          readOnly={pending}
          className="block w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none"
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (!pending) formRef.current?.requestSubmit();
          }}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-xs text-muted-foreground">
            {pending ? "文面を整えています…" : "送った文章は整えてから投稿されます"}
          </span>
          <button
            type="submit"
            disabled={pending}
            aria-label="送信"
            className="rounded-md bg-[#007a5a] p-1.5 text-white disabled:opacity-40"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
      {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
