"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// スマホでは、Slack と同じく一覧とチャンネルを別の画面にする。
// Organization の最初の画面では一覧だけ、チャンネルや質問を開いたらそれだけを出す。PC では両方並べる
export function OrgShell({ orgId, side, children }: { orgId: string; side: ReactNode; children: ReactNode }) {
  const home = usePathname() === `/o/${orgId}`;
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className={cn("w-full shrink-0 md:flex md:w-auto", home ? "flex" : "hidden")}>{side}</div>
      <main className={cn("min-w-0 flex-1 flex-col bg-white md:flex", home ? "hidden" : "flex")}>
        {children}
      </main>
    </div>
  );
}
