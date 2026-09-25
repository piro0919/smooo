"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setAvatar } from "@/app/settings-actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";

const MAX = 2 * 1024 * 1024;

// 画像を選ぶと、自分のフォルダに置いてアイコンにする
export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setError(undefined);
    if (!file.type.startsWith("image/")) return setError("画像を選んでください。");
    if (file.size > MAX) return setError("2MB までの画像にしてください。");

    setBusy(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
    if (uploadError) {
      setBusy(false);
      return setError("アップロードできませんでした。");
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const result = await setAvatar(data.publicUrl);
    setBusy(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} url={url} className="size-12" />
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "アップロードしています…" : "画像を選ぶ"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
