"use client";

import { useActionState, useEffect, useRef } from "react";
import { SendHorizontal, X } from "lucide-react";
import { useComposerTarget } from "./ComposerTarget";
import { postMessage, type PostState } from "@/app/o/[orgId]/c/[channelId]/actions";

// Slack と同じく Enter で送信、Shift+Enter で改行。日本語の変換中の Enter では送らない
export function Composer({
  orgId,
  channelId,
  placeholder,
}: {
  orgId: string;
  channelId: string;
  placeholder: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState<PostState, FormData>(
    postMessage.bind(null, orgId, channelId),
    {},
  );
  const { target, setTarget } = useComposerTarget();

  useEffect(() => {
    if (!state.sent || !textRef.current) return;
    textRef.current.value = "";
    textRef.current.focus();
    setTarget(null);
  }, [state.sent, setTarget]);

  // 返信や訂正を選んだら、すぐ打てるようにする
  useEffect(() => {
    if (target) textRef.current?.focus();
  }, [target]);

  return (
    <form ref={formRef} action={action} className="px-5 pb-5">
      {target && (
        <>
          <input type="hidden" name={target.kind === "correct" ? "corrects" : "reply_to"} value={target.id} />
          <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs">
            <span className="shrink-0 font-bold">
              {target.kind === "correct" ? "訂正するメッセージ" : `${target.author}さんへの返信`}
            </span>
            <span className="truncate text-muted-foreground">{target.body}</span>
            <button
              type="button"
              aria-label="取り消す"
              className="ml-auto shrink-0 rounded p-0.5 hover:bg-zinc-200"
              onClick={() => setTarget(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </>
      )}
      <div
        className={`border border-zinc-300 focus-within:border-zinc-500 ${target ? "rounded-b-lg" : "rounded-lg"}`}
      >
        <textarea
          ref={textRef}
          name="raw"
          rows={3}
          key={state.raw ?? "composer"}
          defaultValue={state.raw}
          placeholder={`${placeholder}。雑に書いても AI が整えます`}
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
            {pending
              ? "AI が文面を作成しています…"
              : target?.kind === "correct"
                ? "訂正の内容を入力してください。元のメッセージは残ります"
                : "送信した文章は、AI が整えてから投稿します"}
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
