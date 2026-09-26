import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// その人がそのチャンネルに書いたとき、どの会社の枠から引くか。今月の使用数と上限も返す
export async function capFor(authorId: string, channelId: string) {
  const admin = createAdminClient();
  const { data: orgId, error } = await admin.rpc("billing_org_for", { author: authorId, channel: channelId });
  if (error) throw error;
  if (!orgId) return { orgId: null, used: 0, cap: 0, over: false };
  const { data: usage, error: usageError } = await admin.rpc("post_usage", { org: orgId }).single();
  if (usageError) throw usageError;
  return { orgId, used: usage.used, cap: usage.cap, over: usage.used >= usage.cap };
}
