"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 自分への質問が増えたら画面を取り直す。サイドバーの件数もこれで変わる
export function LiveQuestions({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      subscription = supabase
        .channel(`questions:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "questions", filter: `user_id=eq.${userId}` },
          () => router.refresh(),
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
