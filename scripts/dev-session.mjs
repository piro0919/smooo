// 手元の Supabase に試験用のユーザーを作り、そのセッションの Cookie を JSON で出す。
// Google ログインを通さずに画面を確かめるためのもの。127.0.0.1 以外には繋がない。
//
//   node --env-file=.env.local scripts/dev-session.mjs <email> [display name]
//
// SUPABASE_SECRET_KEY は `supabase status -o env` の SECRET_KEY。
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const [email, name = email?.split("@")[0]] = process.argv.slice(2);

if (!url?.startsWith("http://127.0.0.1:")) throw new Error(`refusing to run against ${url}`);
if (!secret || !email) throw new Error("usage: SUPABASE_SECRET_KEY=... node scripts/dev-session.mjs <email> [name]");

const password = "dev-session-password";
const admin = createClient(url, secret, { auth: { persistSession: false } });
const { error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});
if (createError && createError.code !== "email_exists") throw createError;

const jar = new Map();
const supabase = createServerClient(url, publishable, {
  cookies: {
    getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
    setAll: (list) => list.forEach(({ name: n, value }) => jar.set(n, value)),
  },
});
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;

console.log(JSON.stringify([...jar].map(([n, value]) => ({ name: n, value }))));
