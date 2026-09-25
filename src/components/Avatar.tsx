import Image from "next/image";
import { cn } from "@/lib/utils";

// アイコン。画像があれば画像、なければ名前の頭文字。Slack と同じく角の丸い四角
export function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  if (url) {
    // 小さな画像なので最適化はかけない。手元の Supabase は 127.0.0.1 で、最適化の対象にできない
    return (
      <Image
        src={url}
        alt=""
        width={36}
        height={36}
        unoptimized
        className={cn("size-9 shrink-0 rounded-md object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md bg-[#4a154b] text-sm font-bold text-white",
        className,
      )}
    >
      {name.slice(0, 1)}
    </div>
  );
}
