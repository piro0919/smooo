"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ONBOARDING } from "@/lib/onboarding";
import { finishOnboarding } from "./actions";

// 選ぶだけで答えられる。「その他」を選んだときだけ入力欄が開く
export function OnboardingForm({ next }: { next: string }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});

  return (
    <form action={finishOnboarding} className="grid gap-8">
      <input type="hidden" name="next" value={next} />
      {ONBOARDING.map((q) => (
        <fieldset key={q.key} className="grid gap-3">
          <legend className="mb-3 font-bold">{q.label}</legend>
          <RadioGroup
            name={q.key}
            onValueChange={(value) => setChosen((c) => ({ ...c, [q.key]: String(value) }))}
          >
            {[...q.options, "other"].map((o) => (
              <Label key={o} className="flex items-center gap-2 font-normal">
                <RadioGroupItem value={o} />
                {o === "other" ? "その他" : o}
              </Label>
            ))}
          </RadioGroup>
          {chosen[q.key] === "other" && <Input name={`${q.key}-other`} placeholder="入力してください" />}
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit">はじめる</Button>
        <Button type="submit" name="skip" value="1" variant="ghost">
          あとで答える
        </Button>
      </div>
    </form>
  );
}
