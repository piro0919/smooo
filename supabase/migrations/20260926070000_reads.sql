-- 既読。チャンネルごとに、最後に開いた時刻を持つ
create table public.channel_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

alter table public.channel_reads enable row level security;

create policy "people read their own reads"
  on public.channel_reads for select to authenticated
  using (user_id = auth.uid());

create policy "people mark channels they are in as read"
  on public.channel_reads for insert to authenticated
  with check (user_id = auth.uid() and private.is_channel_member(channel_id));

create policy "people update their own reads"
  on public.channel_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 未読の投稿があるチャンネル。自分の名前の投稿は数えない。
-- 呼んだ人の権限で動くので、見えない投稿は数えない
create function public.unread_channel_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct m.channel_id
  from public.messages m
  join public.channel_members cm on cm.channel_id = m.channel_id and cm.user_id = auth.uid()
  left join public.channel_reads r on r.channel_id = m.channel_id and r.user_id = auth.uid()
  where m.author_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, cm.joined_at);
$$;

revoke execute on function public.unread_channel_ids() from public, anon;
grant execute on function public.unread_channel_ids() to authenticated;
