-- 投稿数の上限。Organization ごとに月単位で数える。人間の投稿も、AI が本人の名前で書いた投稿も1件。
-- どの会社の枠から引くかは、投稿した時点で決めて billed_org_id に残す。
-- あとで人が会社を移っても、過去の数え方は変わらない

-- 仮の上限。料金の段階を決めるまでの値で、会社ごとに post_cap で上書きできる
alter table public.organizations add column post_cap int;

create function private.default_post_cap()
returns int
language sql
immutable
as $$ select 1000 $$;

alter table public.messages
  add column billed_org_id uuid references public.organizations (id) on delete set null;

create index messages_billed_month_idx on public.messages (billed_org_id, created_at);

-- 書く人から見た、枠を引く会社。そのチャンネルの会社に属していればその会社。
-- 社外から招かれた人なら、その人が属する会社のうち、本人だけのものでない最初の会社。なければ本人だけの会社
create function public.billing_org_for(author uuid, channel uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.organization_id from public.channels c
     join public.memberships m on m.organization_id = c.organization_id and m.user_id = author
     where c.id = channel),
    (select m.organization_id from public.memberships m
     join public.organizations o on o.id = m.organization_id
     where m.user_id = author
     order by o.personal, m.created_at
     limit 1)
  );
$$;

-- 今月の使用数と上限。見られるのはその会社の人だけ
create function public.post_usage(org uuid)
returns table (used int, cap int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.messages
     where billed_org_id = org and created_at >= date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo'),
    (select coalesce(post_cap, private.default_post_cap()) from public.organizations where id = org)
  where private.is_org_member(org) or auth.role() = 'service_role';
$$;

revoke execute on function public.billing_org_for(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.post_usage(uuid) from public, anon;
grant execute on function public.post_usage(uuid) to authenticated;

grant execute on function public.billing_org_for(uuid, uuid) to service_role;
grant execute on function public.post_usage(uuid) to service_role;
