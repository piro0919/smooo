-- 投稿。人間は自分の文章では投稿できない。打った原文と、チャンネルに出る文面を別の表に分け、
-- 原文は本人しか読めないようにする。文面はサーバーが AI に整えさせてから書き込むので、
-- 利用者の権限では投稿の表に書き込めない。API を直接叩いて素の文章を出す道を塞ぐため。

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  -- この発言に責任を持つ人間
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create index messages_channel_created_idx on public.messages (channel_id, created_at);

create table public.message_sources (
  message_id uuid primary key references public.messages (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  raw_text text not null check (char_length(raw_text) between 1 and 4000)
);

alter table public.messages enable row level security;
alter table public.message_sources enable row level security;

create policy "channel members read messages"
  on public.messages for select to authenticated
  using (private.is_channel_member(channel_id));

create policy "authors read what they typed"
  on public.message_sources for select to authenticated
  using (author_id = auth.uid());

-- 書き込みのポリシーは置かない。書くのはサーバーの秘密鍵だけ

-- 新しい投稿を画面に届ける。Realtime は RLS を通るので、見えない投稿は届かない
alter publication supabase_realtime add table public.messages;
