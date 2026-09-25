// チャンネルを開いている途中。投稿の形をした枠を出して、どこに何が来るかを先に見せる
export default function Loading() {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b px-4 md:px-5">
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
      </header>
      <div className="flex flex-1 flex-col justify-end gap-4 px-4 py-4 md:px-5">
        {[0.7, 0.5, 0.85, 0.4].map((w, i) => (
          <div key={i} className="flex gap-2">
            <div className="size-9 shrink-0 animate-pulse rounded-md bg-zinc-200" />
            <div className="grid flex-1 gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="h-4 animate-pulse rounded bg-zinc-100" style={{ width: `${w * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5">
        <div className="h-[106px] rounded-lg border border-zinc-200" />
      </div>
    </>
  );
}
