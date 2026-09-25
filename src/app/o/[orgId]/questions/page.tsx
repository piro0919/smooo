import { BackToList } from "@/components/BackToList";
import { QuestionCard } from "@/components/QuestionCard";
import { createClient } from "@/lib/supabase/server";

const when = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

// AI が本人に聞きたいことの一覧。答えると、その答えで AI が返事をする
export default async function QuestionsPage({ params }: PageProps<"/o/[orgId]/questions">) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, options, deadline, channels(name), messages(body, profiles!messages_author_id_fkey(display_name))")
    .eq("status", "open")
    .order("deadline");

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-5">
        <BackToList orgId={orgId} />
        <h2 className="text-lg font-bold">あなたへの質問</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        {!questions?.length ? (
          <p className="text-muted-foreground">いま答える質問はありません。</p>
        ) : (
          <ul className="grid gap-4">
            {questions.map((q) => (
              <li key={q.id} className="grid gap-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  #{q.channels?.name} ・ {when.format(new Date(q.deadline))} までに答えないと、AI が代わりに返します
                </p>
                <blockquote className="border-l-4 pl-3 text-sm">
                  <span className="font-bold">{q.messages?.profiles?.display_name}</span>
                  <p className="whitespace-pre-wrap">{q.messages?.body}</p>
                </blockquote>
                <p className="font-bold">{q.prompt}</p>
                <QuestionCard
                  orgId={orgId}
                  questionId={q.id}
                  options={Array.isArray(q.options) ? q.options.map(String) : []}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
