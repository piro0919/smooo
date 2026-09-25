-- 招待。社内だけのチャンネルへの招待は作れず、期限切れは使えず、社外の人はチャンネルにだけ入る
begin;
create extension if not exists pgtap;
select plan(9);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'inv-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'inv-b@example.test'),
  ('cccccccc-0000-0000-0000-0000000000c1', 'inv-c@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000a1"}';

create temp table ids as select public.create_organization('Acme') as org;
grant select on ids to authenticated;

select is(
  (select role from memberships m join ids on m.organization_id = ids.org
   where m.user_id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  'owner', 'Organization を作った人は owner になる');

insert into channels (id, organization_id, name, audience) values
  ('c0000000-0000-0000-0000-0000000000a1', (select org from ids), 'general', 'internal'),
  ('c0000000-0000-0000-0000-0000000000a2', (select org from ids), 'client', 'external');

select throws_ok(
  $$ insert into invites (organization_id, channel_id) values
     ((select org from ids), 'c0000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, '社内だけのチャンネルへの招待は作れない');

insert into invites (token, organization_id) values ('org-token', (select org from ids));
insert into invites (token, organization_id, channel_id) values
  ('channel-token', (select org from ids), 'c0000000-0000-0000-0000-0000000000a2');
insert into invites (token, organization_id, expires_at) values
  ('old-token', (select org from ids), now() - interval '1 minute');

-- B は Organization に招かれる
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-0000000000b1"}';

select throws_ok($$ select * from public.accept_invite('old-token') $$,
  'P0002', null, '期限切れの招待は使えない');

select lives_ok($$ select * from public.accept_invite('org-token') $$, 'Organization への招待を受けられる');

select is(
  (select count(*)::int from channels where organization_id = (select org from ids)),
  2, 'Organization に入った人は、その会社のチャンネル一覧を見られる');

-- C は社外の人。チャンネルにだけ招かれる
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-0000000000c1"}';

select lives_ok($$ select * from public.accept_invite('channel-token') $$, 'チャンネルへの招待を受けられる');

select is(
  (select array_agg(name) from channels where organization_id = (select org from ids)),
  array['client'], '社外の人には、招かれたチャンネルだけが見える');

select is(
  (select name from organizations where id = (select org from ids)),
  'Acme', '社外の人にも、招いた会社の名前は見える');

select is(
  (select count(*)::int from memberships where organization_id = (select org from ids)),
  0, '社外の人には、その会社の所属者の一覧は見えない');

select * from finish();
rollback;
