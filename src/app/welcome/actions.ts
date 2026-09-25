"use server";

import { redirect } from "next/navigation";
import { ONBOARDING } from "@/lib/onboarding";
import { safeNext } from "@/lib/next-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 答えをどの相手にも使ってよい記憶として残し、「はじめに」を閉じる。飛ばしたときも閉じる
export async function finishOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memories =
    formData.get("skip") === "1"
      ? []
      : ONBOARDING.flatMap((q) => {
          const chosen = String(formData.get(q.key) ?? "");
          const answer = chosen === "other" ? String(formData.get(`${q.key}-other`) ?? "").trim() : chosen;
          return answer ? [{ user_id: user.id, scope: "general", content: `${q.label}: ${answer}` }] : [];
        });

  const admin = createAdminClient();
  if (memories.length) {
    const { error } = await admin.from("memories").insert(memories);
    if (error) throw error;
  }
  const { error } = await admin
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;

  redirect(safeNext(String(formData.get("next") ?? "/")));
}
