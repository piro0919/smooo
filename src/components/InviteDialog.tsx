"use client";

import { useActionState, useState, type ReactElement, type ReactNode } from "react";
import { createInvite, type InviteState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function InviteDialog({
  orgId,
  channelId = null,
  title,
  description,
  trigger,
  children,
}: {
  orgId: string;
  channelId?: string | null;
  title: string;
  description: string;
  trigger: ReactElement;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState<InviteState>(
    createInvite.bind(null, orgId, channelId),
    {},
  );
  const [copied, setCopied] = useState(false);

  return (
    <Dialog>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {state.url ? (
          <div className="flex gap-2">
            <Input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(state.url!);
                setCopied(true);
              }}
            >
              {copied ? "コピーしました" : "コピー"}
            </Button>
          </div>
        ) : (
          <form action={action}>
            <Button type="submit" disabled={pending}>
              招待リンクを作成する
            </Button>
          </form>
        )}
        {state.url && <p className="text-xs text-muted-foreground">リンクの有効期限は7日間です。</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </DialogContent>
    </Dialog>
  );
}
