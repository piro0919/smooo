"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { saved?: number; error?: string };

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const value = String(formData.get("autonomy"));
  if (!["careful", "standard", "trusting"].includes(value)) return { error: "AI に任せる範囲を選んでください。" };
  const name = String(formData.get("display_name") ?? "").trim();
  if (!name || name.length > 80) return { error: "名前は1〜80文字で入力してください。" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  const { error } = await supabase.from("profiles").update({ autonomy: value, display_name: name }).eq("id", user.id);
  if (error) return { error: "保存できませんでした。" };

  revalidatePath("/", "layout");
  return { saved: Date.now() };
}

// アイコンの URL を保存する。自分のフォルダに置いた、この Supabase の画像だけを受け付ける
export async function setAvatar(url: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!url.startsWith(prefix)) return { error: "この画像は使えません。" };

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: "保存できませんでした。" };
  revalidatePath("/", "layout");
  return {};
}
