"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateOrgState = { error?: string };

export async function createOrganization(
  _prev: CreateOrgState,
  formData: FormData,
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 80) return { error: "名前は1〜80文字で入れてください。" };

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organization", { name });
  if (error || !orgId) return { error: "作れませんでした。" };

  redirect(`/o/${orgId}`);
}

export type InviteState = { url?: string; error?: string };

// 招待のリンクを作る。channelId があれば、社外の人をそのチャンネルにだけ招くリンクになる
export async function createInvite(
  orgId: string,
  channelId: string | null,
): Promise<InviteState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ organization_id: orgId, channel_id: channelId })
    .select("token")
    .single();
  if (error) return { error: "招待のリンクを作れませんでした。" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return { url: `${proto}://${host}/join/${data.token}` };
}
