"use client";

import { Plus } from "lucide-react";
import { startDm } from "@/app/o/[orgId]/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// 同じ Organization の人を選んで DM を始める。同じ相手との DM がすでにあれば、それを開く
export function StartDmDialog({ orgId, people }: { orgId: string; people: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-[15px] text-[#cfc3cf] hover:bg-white/10" />
        }
      >
        <Plus className="size-4" />
        DM を送る
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>DM を送る</DialogTitle>
          <DialogDescription>このワークスペースのメンバーと、2人だけでやり取りします。</DialogDescription>
        </DialogHeader>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">このワークスペースには、まだほかのメンバーがいません。</p>
        ) : (
          <ul className="grid gap-1">
            {people.map((p) => (
              <li key={p.id}>
                <form action={startDm.bind(null, orgId, p.id)}>
                  <button className="w-full rounded-md px-3 py-2 text-left hover:bg-zinc-100">{p.name}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
