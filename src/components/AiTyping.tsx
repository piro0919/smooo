"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STALE_MS = 2 * 60 * 1000;

// 「佐藤さんの AI が返事を考えています…」。Slack の「入力中」に当たる。
// 行は AI が返事を用意している間だけあり、消し損ねても2分たったものは出さない
export function AiTyping({ channelId, userId }: { channelId: string; userId: string }) {
  const [names, setNames] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_typing")
      .select("user_id, started_at, profiles(display_name)")
      .eq("channel_id", channelId);
    const now = Date.now();
    setNames(
      (data ?? [])
        .filter((t) => now - new Date(t.started_at).getTime() < STALE_MS)
        .map((t) => (t.user_id === userId ? "あなた" : `${t.profiles?.display_name ?? "?"}さん`)),
    );
  }, [channelId, userId]);

  useEffect(() => {
    const supabase = createClient();
    let subscription: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      refresh();
      // 消えたときの知らせには中身が付かないので、何か動いたら取り直す
      subscription = supabase
        .channel(`typing:${channelId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "ai_typing" }, () => refresh())
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [channelId, refresh]);

  return (
    <p aria-live="polite" className="h-5 px-5 text-xs text-muted-foreground">
      {names.length > 0 && `${names.join("、")}の AI が返事を考えています…`}
    </p>
  );
}
