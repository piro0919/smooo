"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // 成功すれば Google へ移動するので、戻ってくるのは失敗したときだけ
    if (error) setPending(false);
  }

  return (
    <Button size="lg" onClick={signIn} disabled={pending}>
      Google でログイン
    </Button>
  );
}
