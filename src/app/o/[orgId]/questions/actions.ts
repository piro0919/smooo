"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { respondWithAnswer } from "@/lib/ai/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AnswerState = { error?: string };

// 質問に答える。本人への質問かを本人の権限で確かめてから、サーバーの鍵で書き込む
export async function answerQuestion(
  orgId: string,
  questionId: string,
  _prev: AnswerState,
  formData: FormData,
): Promise<AnswerState> {
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer) return { error: "答えを選ぶか、入力してください。" };

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select("id, status")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) return { error: "この質問には答えられません。" };
  if (question.status !== "open") return { error: "この質問は締め切られました。" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("questions")
    .update({ status: "answered", answer, answered_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("status", "open");
  if (error) return { error: "答えを送信できませんでした。" };

  after(async () => {
    try {
      await respondWithAnswer(questionId);
    } catch (error) {
      console.error("respondWithAnswer", error);
    }
  });

  revalidatePath(`/o/${orgId}`, "layout");
  return {};
}
