-- 「AI が返事を考えています」の表示のもと。AI が返事を用意している間だけ行がある
create table public.ai_typing (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.ai_typing enable row level security;

create policy "channel members see who is typing"
  on public.ai_typing for select to authenticated
  using (private.is_channel_member(channel_id));

-- 書き込むのはサーバーだけ

alter publication supabase_realtime add table public.ai_typing;
