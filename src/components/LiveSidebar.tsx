"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 自分への質問か、どこかのチャンネルへの投稿が増えたら画面を取り直す。
// サイドバーの質問の件数と、未読の太字がこれで変わる。見えない投稿は RLS で届かない
export function LiveSidebar({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      subscription = supabase
        .channel(`sidebar:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "questions", filter: `user_id=eq.${userId}` },
          () => router.refresh(),
        )
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
          router.refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [userId, router]);

  return null;
}
