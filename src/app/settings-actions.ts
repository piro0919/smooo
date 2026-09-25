"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { saved?: number; error?: string };

export async function saveAutonomy(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const value = String(formData.get("autonomy"));
  if (!["careful", "standard", "trusting"].includes(value)) return { error: "選び直してください。" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが切れています。" };

  const { error } = await supabase.from("profiles").update({ autonomy: value }).eq("id", user.id);
  if (error) return { error: "保存できませんでした。" };

  revalidatePath("/", "layout");
  return { saved: Date.now() };
}
