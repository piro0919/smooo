-- AI が人間に聞く仕組み。AI が答えられないときだけ、本人に選択肢つきの質問を出す。
-- 本人の答えは記憶として残し、次から同じことを聞かない。記憶は画面に出さない。

-- 投稿が人間の打った文章からできたのか、AI が本人に代わって書いたのか。
-- 画面ではどちらも同じに見せる。AI の返信をきっかけに、さらに AI が返すのを止めるために持つ
alter table public.messages
  add column origin text not null default 'human' check (origin in ('human', 'ai'));

-- 原文の表には、AI が書いた場合はその下書きを入れる。本人にだけ見える
alter table public.message_sources
  add column kind text not null default 'typed' check (kind in ('typed', 'ai'));

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  -- 聞かれている人
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- どの投稿に答えるための質問か
  message_id uuid not null references public.messages (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'answered', 'expired')),
  answer text,
  deadline timestamptz not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index questions_user_open_idx on public.questions (user_id) where status = 'open';

alter table public.questions enable row level security;

-- 読めるのは聞かれている本人だけ。答えるのはサーバーが確かめてから書く
create policy "people read questions for them"
  on public.questions for select to authenticated
  using (user_id = auth.uid());

-- AI の記憶。scope が internal なら社内のチャンネルで覚えたもので、社内でだけ使う。
-- channel なら社外も入るチャンネルで覚えたもので、そのチャンネルでだけ使う。
-- 社外のどの相手にも使ってよい一般的な記憶は、振り分けを作るときに足す
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope text not null check (scope in ('internal', 'channel')),
  channel_id uuid references public.channels (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  check ((scope = 'channel') = (channel_id is not null))
);

create index memories_user_idx on public.memories (user_id, organization_id);

-- 記憶は画面に出さない。本人を含め、利用者の権限では読めない
alter table public.memories enable row level security;

alter publication supabase_realtime add table public.questions;
