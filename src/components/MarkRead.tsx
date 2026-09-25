"use client";

import { useEffect } from "react";
import { markRead } from "@/app/o/[orgId]/actions";

// いちばん新しい投稿が変わるたびに既読を付け直す
export function MarkRead({ orgId, channelId, latest }: { orgId: string; channelId: string; latest?: string }) {
  useEffect(() => {
    markRead(orgId, channelId);
  }, [orgId, channelId, latest]);
  return null;
}
