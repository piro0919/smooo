-- DM。同じ Organization の2人だけの場。同じ Organization の人にも、存在ごと見せない。
-- チャンネルの表に kind を足して持つ。投稿、整形、AI の代理返答はチャンネルと同じ仕組みで動く

alter table public.channels
  add column kind text not null default 'channel' check (kind in ('channel', 'dm'));

-- DM には名前がない。画面では相手の名前を出す
alter table public.channels alter column name drop not null;
alter table public.channels drop constraint channels_name_check;
alter table public.channels add constraint channels_name_check check (
  (kind = 'dm' and name is null)
  or (kind = 'channel' and name ~ '^[a-z0-9ぁ-んァ-ヶー一-龯_-]{1,80}$')
);
-- DM は社外の人を入れない
alter table public.channels add constraint channels_dm_internal check (kind = 'channel' or audience = 'internal');

-- 見える範囲を、DM は当人だけに絞る
drop policy "members read channels" on public.channels;
create policy "members read channels"
  on public.channels for select to authenticated
  using (
    (kind = 'channel' and private.is_org_member(organization_id))
    or private.is_channel_member(id)
  );

-- DM は create_dm からだけ作る
drop policy "members create channels in their organizations" on public.channels;
create policy "members create channels in their organizations"
  on public.channels for insert to authenticated
  with check (kind = 'channel' and private.is_org_member(organization_id) and created_by = auth.uid());

drop policy "members read who is in a channel" on public.channel_members;
create policy "members read who is in a channel"
  on public.channel_members for select to authenticated
  using (
    private.is_channel_member(channel_id)
    or exists (
      select 1 from public.channels c
      where c.id = channel_id and c.kind = 'channel' and private.is_org_member(c.organization_id)
    )
  );

drop policy "members join channels of their organizations" on public.channel_members;
create policy "members join channels of their organizations"
  on public.channel_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.channels c
      where c.id = channel_id and c.kind = 'channel' and private.is_org_member(c.organization_id)
    )
  );

-- 同じ Organization の相手との DM を開く。すでにあればそれを返す
create function public.create_dm(org uuid, other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  dm uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if other = auth.uid() then
    raise exception 'cannot open a DM with yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.memberships where organization_id = org and user_id = auth.uid())
     or not exists (select 1 from public.memberships where organization_id = org and user_id = other) then
    raise exception 'both people must belong to the organisation' using errcode = '42501';
  end if;

  select c.id into dm
  from public.channels c
  where c.organization_id = org and c.kind = 'dm'
    and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = auth.uid())
    and exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = other)
  limit 1;
  if dm is not null then
    return dm;
  end if;

  -- 作った人はトリガーで参加者になる
  insert into public.channels (organization_id, kind, name, created_by)
  values (org, 'dm', null, auth.uid())
  returning id into dm;
  insert into public.channel_members (channel_id, user_id) values (dm, other);
  return dm;
end;
$$;

revoke execute on function public.create_dm(uuid, uuid) from public, anon;
grant execute on function public.create_dm(uuid, uuid) to authenticated;
