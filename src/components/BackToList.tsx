import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// スマホでだけ出る、一覧へ戻るボタン
export function BackToList({ orgId }: { orgId: string }) {
  return (
    <Link href={`/o/${orgId}`} aria-label="一覧へ戻る" className="-ml-2 rounded-md p-1 hover:bg-zinc-100 md:hidden">
      <ChevronLeft className="size-5" />
    </Link>
  );
}
