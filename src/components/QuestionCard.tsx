"use client";

import { useActionState, useState } from "react";
import { answerQuestion, type AnswerState } from "@/app/o/[orgId]/questions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 選択肢を押すだけで答えられる。最後の「その他」を押したときだけ入力欄が開く
export function QuestionCard({
  orgId,
  questionId,
  options,
}: {
  orgId: string;
  questionId: string;
  options: string[];
}) {
  const [other, setOther] = useState(false);
  const [state, action, pending] = useActionState<AnswerState, FormData>(
    answerQuestion.bind(null, orgId, questionId),
    {},
  );

  return (
    <form action={action} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o} type="submit" name="answer" value={o} variant="outline" disabled={pending}>
            {o}
          </Button>
        ))}
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOther(true)}>
          その他
        </Button>
      </div>
      {other && (
        <div className="flex gap-2">
          <Input name="answer" placeholder="答えを入力" autoFocus disabled={pending} />
          <Button type="submit" disabled={pending}>
            送る
          </Button>
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
