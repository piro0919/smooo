"use client";

import { Button } from "@/components/ui/button";

// 画面の読み込みに失敗したとき。サイドバーは残し、中身だけ出し直せるようにする
export default function OrgError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-muted-foreground">読み込めませんでした。</p>
      <Button variant="outline" onClick={reset}>
        もう一度読み込む
      </Button>
    </div>
  );
}
