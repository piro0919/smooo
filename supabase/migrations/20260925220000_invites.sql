-- 会社の Organization を作り、リンクで人を招く。招待は2種類。
-- Organization への招待は、その会社の人として迎える。
-- チャンネルへの招待は、社外の人をそのチャンネルにだけ迎える。社内だけのチャンネルには作れない。

create table public.invites (
  token text primary key default translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_'),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null なら Organization への招待。値があれば、そのチャンネルへの招待
  channel_id uuid references public.channels (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- 招待を作れるのは、その Organization の人だけ。チャンネルへの招待は社外も入れるチャンネルに限る
create policy "members create invites"
  on public.invites for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_org_member(organization_id)
    and (
      channel_id is null
      or exists (
        select 1 from public.channels c
        where c.id = channel_id
          and c.organization_id = invites.organization_id
          and c.audience = 'external'
      )
    )
  );

create policy "members read their invites"
  on public.invites for select to authenticated
  using (private.is_org_member(organization_id));

-- 会社の Organization を作る。作った人が owner になる。
-- 作った直後はまだ所属していないので、利用者の権限では作った行を読み返せない。まとめてここで行う
create function public.create_organization(name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.organizations (name) values (trim(name)) returning id into org;
  insert into public.memberships (organization_id, user_id, role) values (org, auth.uid(), 'owner');
  return org;
end;
$$;

-- 招待を受ける。行き先の Organization とチャンネルを返す。
-- 招待された人はまだ所属していないので、招待の行を読めない。ここで確かめて入れる
create function public.accept_invite(invite_token text)
returns table (organization_id uuid, channel_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into inv from public.invites where token = invite_token;
  if inv is null or inv.expires_at < now() then
    raise exception 'invite not found or expired' using errcode = 'P0002';
  end if;

  if inv.channel_id is null then
    insert into public.memberships (organization_id, user_id)
    values (inv.organization_id, auth.uid())
    on conflict do nothing;
  else
    -- 社内だけのチャンネルに社外の人が入らないことは、channel_members のトリガーが守る
    insert into public.channel_members (channel_id, user_id)
    values (inv.channel_id, auth.uid())
    on conflict do nothing;
  end if;

  return query select inv.organization_id, inv.channel_id;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- 社外とのチャンネルに入った人には、相手の会社名だけ見せる。自分の側のサイドバーに
-- 「どこの会社とのチャンネルか」を出すため。相手のほかのチャンネルや人は見えないまま
create function private.is_guest_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    join public.channel_members m on m.channel_id = c.id
    where c.organization_id = org and c.audience = 'external' and m.user_id = auth.uid()
  );
$$;

grant execute on function private.is_guest_of(uuid) to authenticated;

create policy "guests read the name of the organisation they were invited by"
  on public.organizations for select to authenticated
  using (private.is_guest_of(id));
