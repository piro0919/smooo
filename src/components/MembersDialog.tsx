"use client";

import { useActionState } from "react";
import { MoreHorizontal } from "lucide-react";
import { leaveOrganization, type LeaveState } from "@/app/o/[orgId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Organization の人の一覧と、抜ける操作
export function MembersDialog({
  orgId,
  orgName,
  personal,
  members,
}: {
  orgId: string;
  orgName: string;
  personal: boolean;
  members: { id: string; name: string; owner: boolean; me: boolean }[];
}) {
  const [state, action, pending] = useActionState<LeaveState>(leaveOrganization.bind(null, orgId), {});

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button aria-label="メンバー" className="rounded-md p-1.5 text-white hover:bg-white/10" />
        }
      >
        <MoreHorizontal className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{orgName} のメンバー</DialogTitle>
          <DialogDescription>{members.length}人</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-80 gap-1 overflow-y-auto">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-[#4a154b] text-xs font-bold text-white">
                {m.name.slice(0, 1)}
              </span>
              <span>
                {m.name}
                {m.me && <span className="text-muted-foreground">（あなた）</span>}
              </span>
              {m.owner && <span className="ml-auto text-xs text-muted-foreground">owner</span>}
            </li>
          ))}
        </ul>
        {!personal && (
          <form action={action} className="grid gap-2 border-t pt-4">
            <Button type="submit" variant="outline" disabled={pending}>
              {orgName} を抜ける
            </Button>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
