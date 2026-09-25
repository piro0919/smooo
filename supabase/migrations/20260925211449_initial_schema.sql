-- 人は必ずどこかの Organization に属し、チャンネルは Organization に属する。
-- チャンネルは「社内だけ」か「社外の人も入れる」のどちらかで、社内だけのチャンネルに
-- 社外の人は入れない。これを画面ではなくデータベースで守る。

create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- サインアップ時に自動でできる、本人だけの Organization
  personal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9ぁ-んァ-ヶー一-龯_-]{1,80}$'),
  audience text not null default 'internal' check (audience in ('internal', 'external')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_id_idx on public.channel_members (user_id);

-- ポリシーから所属を引くための関数。表のポリシーから同じ表を引くと再帰するので、
-- 権限を上げて読む。API から呼べないよう private スキーマに置く。

create function private.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;

create function private.is_channel_member(channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = channel and user_id = auth.uid()
  );
$$;

-- 相手と同じ Organization か、同じチャンネルにいれば、名前と顔が見える
create function private.shares_space(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b using (organization_id)
    where a.user_id = auth.uid() and b.user_id = other
  ) or exists (
    select 1 from public.channel_members a
    join public.channel_members b using (channel_id)
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;

create policy "members read their organizations"
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy "people read profiles they share a space with"
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_space(id));

create policy "people edit their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "members read memberships of their organizations"
  on public.memberships for select to authenticated
  using (private.is_org_member(organization_id));

-- Organization の人はそのチャンネル一覧を見られる。社外の人は参加したチャンネルだけ
create policy "members read channels"
  on public.channels for select to authenticated
  using (private.is_org_member(organization_id) or private.is_channel_member(id));

create policy "members create channels in their organizations"
  on public.channels for insert to authenticated
  with check (private.is_org_member(organization_id) and created_by = auth.uid());

create policy "members read who is in a channel"
  on public.channel_members for select to authenticated
  using (
    private.is_channel_member(channel_id)
    or private.is_org_member((select organization_id from public.channels where id = channel_id))
  );

-- 今は自分の Organization のチャンネルに自分で入ることだけ。招待は後で足す
create policy "members join channels of their organizations"
  on public.channel_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_org_member((select organization_id from public.channels where id = channel_id))
  );

create policy "people leave channels"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid());

-- 社内だけのチャンネルには、その Organization の人しか入れない。
-- ポリシーは入る人の権限でしか判定できないので、招待のように他人を入れる経路が
-- 増えても崩れないよう、行そのものに対して確かめる。
create function private.check_channel_audience()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.channels;
begin
  select * into ch from public.channels where id = new.channel_id;
  if ch.audience = 'internal' and not exists (
    select 1 from public.memberships
    where organization_id = ch.organization_id and user_id = new.user_id
  ) then
    raise exception 'outsiders cannot join an internal channel'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger channel_members_check_audience
  before insert on public.channel_members
  for each row execute function private.check_channel_audience();

-- チャンネルを作った人は、そのまま参加者になる
create function private.join_created_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.channel_members (channel_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger channels_join_creator
  after insert on public.channels
  for each row execute function private.join_created_channel();

-- サインアップしたら、プロフィールと本人だけの Organization を作る。
-- 会社の Organization には後から招待で入る。
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );
  org uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(name, 80), new.raw_user_meta_data ->> 'avatar_url');

  insert into public.organizations (name, personal)
  values (left(name, 80), true)
  returning id into org;

  insert into public.memberships (organization_id, user_id, role)
  values (org, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
