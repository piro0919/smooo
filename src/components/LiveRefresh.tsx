"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 新しい投稿やリアクションが入ったら画面を取り直す。見えない投稿は RLS で届かない。
// Realtime はログインのトークンを渡してから購読しないと匿名扱いになり、何も届かない
export function LiveRefresh({ channelId }: { channelId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      subscription = supabase
        .channel(`messages:${channelId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
          () => router.refresh(),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reactions", filter: `channel_id=eq.${channelId}` },
          () => router.refresh(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [channelId, router]);

  return null;
}
