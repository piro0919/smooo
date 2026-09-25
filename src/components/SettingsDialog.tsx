"use client";

import { useActionState } from "react";
import { Settings } from "lucide-react";
import { saveAutonomy, type SettingsState } from "@/app/settings-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const CHOICES = [
  {
    value: "careful",
    label: "慎重",
    help: "前に答えた内容がそのまま使えるときだけ、AI が答えます。",
  },
  {
    value: "standard",
    label: "標準",
    help: "覚えていることから確実に言えるときだけ、AI が答えます。",
  },
  {
    value: "trusting",
    label: "任せる",
    help: "無理なく判断できれば AI が答えます。お金や契約のような重い判断だけ聞きます。",
  },
];

export function SettingsDialog({ autonomy }: { autonomy: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveAutonomy, {});

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-sm hover:bg-white/10" />
        }
      >
        <Settings className="size-4" />
        設定
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>AI に任せる範囲</DialogTitle>
            <DialogDescription>
              あなたに向けられた質問に、AI があなたに聞かずに答えてよい範囲です。
            </DialogDescription>
          </DialogHeader>
          <RadioGroup key={autonomy} name="autonomy" defaultValue={autonomy} className="gap-4">
            {CHOICES.map((c) => (
              <Label key={c.value} className="flex items-start gap-3 font-normal">
                <RadioGroupItem value={c.value} className="mt-0.5" />
                <span className="grid gap-1">
                  <span className="font-bold">{c.label}</span>
                  <span className="text-muted-foreground">{c.help}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            {state.saved && !pending && <span className="self-center text-sm text-muted-foreground">保存しました</span>}
            <Button type="submit" disabled={pending}>
              保存する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
