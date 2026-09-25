-- DM は当人2人にしか見えない。同じ Organization の3人目にも、存在ごと見えない
begin;
create extension if not exists pgtap;
select plan(7);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000d1', 'dm-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'dm-b@example.test'),
  ('cccccccc-0000-0000-0000-0000000000d3', 'dm-c@example.test'),
  ('dddddddd-0000-0000-0000-0000000000d4', 'dm-d@example.test');

insert into organizations (id, name) values ('0e000000-0000-0000-0000-0000000000d0', 'Acme');
insert into memberships (organization_id, user_id) values
  ('0e000000-0000-0000-0000-0000000000d0', 'aaaaaaaa-0000-0000-0000-0000000000d1'),
  ('0e000000-0000-0000-0000-0000000000d0', 'bbbbbbbb-0000-0000-0000-0000000000d2'),
  ('0e000000-0000-0000-0000-0000000000d0', 'cccccccc-0000-0000-0000-0000000000d3');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000d1"}';

create temp table dm as
  select public.create_dm('0e000000-0000-0000-0000-0000000000d0', 'bbbbbbbb-0000-0000-0000-0000000000d2') as id;
grant select on dm to authenticated;

select is(
  public.create_dm('0e000000-0000-0000-0000-0000000000d0', 'bbbbbbbb-0000-0000-0000-0000000000d2'),
  (select id from dm), '同じ相手との DM は1つだけ');

select throws_ok(
  $$ select public.create_dm('0e000000-0000-0000-0000-0000000000d0', 'dddddddd-0000-0000-0000-0000000000d4') $$,
  '42501', null, 'Organization の外の人とは DM を開けない');

select throws_ok(
  $$ insert into channels (organization_id, kind, created_by) values
     ('0e000000-0000-0000-0000-0000000000d0', 'dm', 'aaaaaaaa-0000-0000-0000-0000000000d1') $$,
  '42501', null, 'DM は create_dm からしか作れない');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-0000000000d2"}';
select is((select count(*)::int from channels where id = (select id from dm)), 1, '相手には DM が見える');

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-0000000000d3"}';
select is((select count(*)::int from channels where id = (select id from dm)), 0, '同じ Organization の3人目にも DM は見えない');
select is((select count(*)::int from channel_members where channel_id = (select id from dm)), 0, '3人目には DM の参加者も見えない');
select throws_ok(
  $$ insert into channel_members (channel_id, user_id) values ((select id from dm), 'cccccccc-0000-0000-0000-0000000000d3') $$,
  '42501', null, '3人目は DM に入れない');

select * from finish();
rollback;
