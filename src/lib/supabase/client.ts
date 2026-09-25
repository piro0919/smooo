import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// ブラウザ側のクライアント。@supabase/ssr が書いた Cookie からセッションを読むので、
// サーバーコンポーネントと同じログイン状態になる
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
