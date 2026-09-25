"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createOrganization, type CreateOrgState } from "@/app/actions";
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

export function CreateOrgDialog() {
  const [state, action, pending] = useActionState<CreateOrgState, FormData>(createOrganization, {});

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            aria-label="Organization を作成する"
            className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          />
        }
      >
        <Plus className="size-5" />
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Organization を作成する</DialogTitle>
            <DialogDescription>会社やチームの単位です。作ったあと、リンクで人を招けます。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="org-name">名前</Label>
            <Input id="org-name" name="name" placeholder="例: 株式会社サンプル" required autoFocus />
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
