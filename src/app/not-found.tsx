import Link from "next/link";

// 存在しないページと、見る権限のないページ。どちらかは区別しない
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold">見つかりません</h1>
      <p className="text-muted-foreground">ページがないか、見る権限がありません。</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        トップに戻る
      </Link>
    </main>
  );
}
