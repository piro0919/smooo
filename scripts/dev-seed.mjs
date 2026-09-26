// 手元の Supabase に、画面を試すための一式を入れる。AI は呼ばない。
//   node --env-file=.env.local scripts/dev-seed.mjs
// SUPABASE_SECRET_KEY は `supabase status -o env` の SECRET_KEY。127.0.0.1 以外には繋がない。
//
// 河村（owner）と佐藤が「株式会社サンプル」の社員、鈴木は社外の人。
// #general は社内だけ、#client-x は社外の人も入れる。河村と佐藤の DM もある。
// ログインは http://127.0.0.1:3000/auth/dev?email=a@example.test（b, c も同じ）
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url?.startsWith("http://127.0.0.1:")) throw new Error(`refusing to run against ${url}`);
if (!secret) throw new Error("SUPABASE_SECRET_KEY is required");

const db = createClient(url, secret, { auth: { persistSession: false } });
const must = async (promise) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

const people = [
  ["a@example.test", "河村"],
  ["b@example.test", "佐藤"],
  ["c@example.test", "鈴木"],
];
const ids = {};
for (const [email, name] of people) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "dev-session-password",
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error?.code === "email_exists") throw new Error(`${email} already exists — run on a fresh database`);
  if (error) throw error;
  ids[name] = data.user.id;
}
await must(
  db.from("profiles").update({ onboarded_at: new Date().toISOString() }).in("id", Object.values(ids)),
);

const org = await must(db.from("organizations").insert({ name: "株式会社サンプル" }).select("id").single());
await must(
  db.from("memberships").insert([
    { organization_id: org.id, user_id: ids["河村"], role: "owner" },
    { organization_id: org.id, user_id: ids["佐藤"], role: "member" },
  ]),
);

const channel = async (name, audience) =>
  must(
    db
      .from("channels")
      .insert({ organization_id: org.id, name, audience, created_by: ids["河村"] })
      .select("id")
      .single(),
  );
const general = await channel("general", "internal");
const client = await channel("client-x", "external");
await must(
  db.from("channel_members").insert([
    { channel_id: general.id, user_id: ids["佐藤"] },
    { channel_id: client.id, user_id: ids["佐藤"] },
    { channel_id: client.id, user_id: ids["鈴木"] },
  ]),
);

const dm = await must(
  db.from("channels").insert({ organization_id: org.id, kind: "dm", created_by: ids["河村"] }).select("id").single(),
);
await must(db.from("channel_members").insert({ channel_id: dm.id, user_id: ids["佐藤"] }));

// 投稿は、打った原文と整えた文面の組で入れる
const posts = [
  [general.id, "河村", "今週の定例、木曜15時からでお願いします", "今週の定例は木曜15時からでお願いします。"],
  [general.id, "佐藤", "了解です", "承知しました。"],
  [client.id, "鈴木", "資料見ました。来週どっか30分ください", "お世話になっております。資料を拝見いたしました。来週、30分ほどお時間をいただけますでしょうか。"],
  [client.id, "河村", "来週火曜の15時からでどうですか", "来週火曜の15時からでいかがでしょうか。"],
  [dm.id, "河村", "明日の午後ちょっと話せる？", "お疲れ様です。明日の午後、少しお話しできますか？"],
];
for (const [channelId, author, raw, body] of posts) {
  const message = await must(
    db
      .from("messages")
      .insert({ channel_id: channelId, author_id: ids[author], body, billed_org_id: org.id })
      .select("id")
      .single(),
  );
  await must(db.from("message_sources").insert({ message_id: message.id, author_id: ids[author], raw_text: raw }));
}

console.log(`seeded: organisation ${org.id}, #general ${general.id}, #client-x ${client.id}, DM ${dm.id}`);
