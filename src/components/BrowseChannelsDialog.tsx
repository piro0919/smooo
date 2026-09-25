"use client";

import { Globe, Hash, Search } from "lucide-react";
import { joinChannel } from "@/app/o/[orgId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Channel = { id: string; name: string; audience: string };

// まだ参加していない、この Organization のチャンネルを探して入る
export function BrowseChannelsDialog({ orgId, channels }: { orgId: string; channels: Channel[] }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-[15px] text-[#cfc3cf] hover:bg-white/10" />
        }
      >
        <Search className="size-4" />
        チャンネルを探す
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>チャンネルを探す</DialogTitle>
          <DialogDescription>この Organization の、まだ参加していないチャンネルです。</DialogDescription>
        </DialogHeader>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">参加していないチャンネルはありません。</p>
        ) : (
          <ul className="grid gap-1">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {c.audience === "external" ? <Globe className="size-4" /> : <Hash className="size-4" />}
                  <span className="truncate">{c.name}</span>
                </span>
                <form action={joinChannel.bind(null, orgId, c.id)}>
                  <Button type="submit" size="sm" variant="outline">
                    参加する
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
