"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createChannel, type CreateChannelState } from "@/app/o/[orgId]/actions";

export function CreateChannelDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateChannelState, FormData>(
    createChannel.bind(null, orgId),
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-[15px] text-[#cfc3cf] hover:bg-white/10" />
        }
      >
        <Plus className="size-4" />
        チャンネルを追加する
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>チャンネルを作成する</DialogTitle>
            <DialogDescription>
              社内だけのチャンネルには、このワークスペースのメンバーしか参加できません。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="channel-name">チャンネル名</Label>
            <Input id="channel-name" name="name" placeholder="例: 企画-2026" required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label>参加できる人</Label>
            <RadioGroup name="audience" defaultValue="internal">
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="internal" />
                社内のメンバーだけ
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <RadioGroupItem value="external" />
                社外の人も参加できる
              </Label>
            </RadioGroup>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              作成する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
