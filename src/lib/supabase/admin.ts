import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// RLS を越えて書き込むためのクライアント。投稿は AI が整えた文面だけを、サーバーがここから書く
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
