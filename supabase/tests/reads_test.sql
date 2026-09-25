-- 未読。ほかの人の投稿だけを数え、開いたら消え、他人の既読は読めない
begin;
create extension if not exists pgtap;
select plan(5);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'rd-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-0000000000e2', 'rd-b@example.test');
insert into organizations (id, name) values ('0e000000-0000-0000-0000-0000000000e0', 'Acme');
insert into memberships (organization_id, user_id) values
  ('0e000000-0000-0000-0000-0000000000e0', 'aaaaaaaa-0000-0000-0000-0000000000e1'),
  ('0e000000-0000-0000-0000-0000000000e0', 'bbbbbbbb-0000-0000-0000-0000000000e2');
insert into channels (id, organization_id, name, created_by) values
  ('c0000000-0000-0000-0000-0000000000e0', '0e000000-0000-0000-0000-0000000000e0', 'general',
   'aaaaaaaa-0000-0000-0000-0000000000e1');
insert into channel_members (channel_id, user_id, joined_at) values
  ('c0000000-0000-0000-0000-0000000000e0', 'bbbbbbbb-0000-0000-0000-0000000000e2', now() - interval '1 hour');
update channel_members set joined_at = now() - interval '1 hour' where channel_id = 'c0000000-0000-0000-0000-0000000000e0';
insert into messages (channel_id, author_id, body) values
  ('c0000000-0000-0000-0000-0000000000e0', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'お知らせです。');

set local role authenticated;

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000e1"}';
select is((select count(*)::int from public.unread_channel_ids()), 0, '自分の投稿は未読に数えない');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-0000000000e2"}';
select is((select count(*)::int from public.unread_channel_ids()), 1, 'ほかの人の投稿は未読になる');
insert into channel_reads (user_id, channel_id) values
  ('bbbbbbbb-0000-0000-0000-0000000000e2', 'c0000000-0000-0000-0000-0000000000e0');
select is((select count(*)::int from public.unread_channel_ids()), 0, '開いたら未読は消える');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000e1"}';
select is((select count(*)::int from channel_reads), 0, 'ほかの人の既読は読めない');
select throws_ok(
  $$ insert into channel_reads (user_id, channel_id) values
     ('bbbbbbbb-0000-0000-0000-0000000000e2', 'c0000000-0000-0000-0000-0000000000e0') $$,
  '42501', null, 'ほかの人の既読は付けられない');

select * from finish();
rollback;
