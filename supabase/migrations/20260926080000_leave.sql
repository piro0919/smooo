-- Organization を抜ける。その会社のチャンネルと DM からも抜ける。
-- 本人だけの Organization と、自分しか owner がいない会社は抜けられない。管理する人がいなくなるため
create function public.leave_organization(org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.organizations where id = org and personal) then
    raise exception 'cannot leave your personal organisation' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.memberships
    where organization_id = org and user_id = auth.uid() and role = 'owner'
  ) and not exists (
    select 1 from public.memberships
    where organization_id = org and user_id <> auth.uid() and role = 'owner'
  ) then
    raise exception 'the last owner cannot leave' using errcode = '22023';
  end if;

  delete from public.channel_members
  where user_id = auth.uid()
    and channel_id in (select id from public.channels where organization_id = org);
  delete from public.memberships where organization_id = org and user_id = auth.uid();
end;
$$;

revoke execute on function public.leave_organization(uuid) from public, anon;
grant execute on function public.leave_organization(uuid) to authenticated;
