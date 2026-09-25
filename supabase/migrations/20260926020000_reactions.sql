-- リアクション。人間は付けない。投稿が入ったとき、ほかの参加者の AI が付ける
create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  -- 画面に届けるときの絞り込みに使う
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '🙏', '🎉', '👀', '✅', '😂')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.reactions enable row level security;

create policy "channel members read reactions"
  on public.reactions for select to authenticated
  using (private.is_channel_member(channel_id));

-- 書き込みのポリシーは置かない。付けるのはサーバーだけ

alter publication supabase_realtime add table public.reactions;
