"use client";

import type { ReactNode } from "react";
import { leaveChannel } from "@/app/o/[orgId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "./Avatar";

// 見出しを押すと開く。参加者の一覧と、抜ける操作。社外の人には会社名を添える
export function ChannelDetailsDialog({
  orgId,
  channelId,
  title,
  canLeave,
  members,
  children,
}: {
  orgId: string;
  channelId: string;
  title: string;
  canLeave: boolean;
  members: { id: string; name: string; avatarUrl: string | null; company: string | null }[];
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<button className="flex min-w-0 items-center gap-2 rounded-md px-1 hover:bg-zinc-100" />}
      >
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>メンバー {members.length}人</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-80 gap-1 overflow-y-auto">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
              <Avatar name={m.name} url={m.avatarUrl} className="size-7 text-xs" />
              <span>{m.name}</span>
              {m.company && <span className="ml-auto text-xs text-muted-foreground">{m.company}</span>}
            </li>
          ))}
        </ul>
        {canLeave && (
          <form action={leaveChannel.bind(null, orgId, channelId)} className="border-t pt-4">
            <Button type="submit" variant="outline" className="w-full">
              チャンネルから退出する
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
