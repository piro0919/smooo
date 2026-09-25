-- 投稿の見える範囲と、書き込めないこと。人間が API を直接叩いて素の文章を出せたら、
-- このツールの前提が崩れる。原文が本人以外に見えても同じく崩れる。
begin;
create extension if not exists pgtap;
select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'msg-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'msg-b@example.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'msg-c@example.test');

insert into organizations (id, name) values ('0e000000-0000-0000-0000-0000000000aa', 'Acme');
insert into memberships (organization_id, user_id) values
  ('0e000000-0000-0000-0000-0000000000aa', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  ('0e000000-0000-0000-0000-0000000000aa', 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into channels (id, organization_id, name, created_by) values
  ('c0000000-0000-0000-0000-0000000000aa', '0e000000-0000-0000-0000-0000000000aa', 'general',
   'aaaaaaaa-0000-0000-0000-00000000000a');
insert into channel_members (channel_id, user_id) values
  ('c0000000-0000-0000-0000-0000000000aa', 'bbbbbbbb-0000-0000-0000-00000000000b');

-- サーバーが書き込んだ投稿
insert into messages (id, channel_id, author_id, body) values
  ('d0000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-0000000000aa',
   'aaaaaaaa-0000-0000-0000-00000000000a', '明日の会議は15時からでよろしいでしょうか。');
insert into message_sources (message_id, author_id, raw_text) values
  ('d0000000-0000-0000-0000-0000000000aa', 'aaaaaaaa-0000-0000-0000-00000000000a', '明日15時でいい？');

insert into reactions (message_id, channel_id, user_id, emoji) values
  ('d0000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-0000000000aa',
   'bbbbbbbb-0000-0000-0000-00000000000b', '👍');

set local role authenticated;

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-00000000000a"}';

select throws_ok(
  $$ insert into reactions (message_id, channel_id, user_id, emoji) values
     ('d0000000-0000-0000-0000-0000000000aa', 'c0000000-0000-0000-0000-0000000000aa',
      'aaaaaaaa-0000-0000-0000-00000000000a', '🎉') $$,
  '42501', null, '人間はリアクションを付けられない');

select is(
  (select raw_text from message_sources where message_id = 'd0000000-0000-0000-0000-0000000000aa'),
  '明日15時でいい？', '本人は自分が打った原文を読める');

select throws_ok(
  $$ insert into messages (channel_id, author_id, body) values
     ('c0000000-0000-0000-0000-0000000000aa', 'aaaaaaaa-0000-0000-0000-00000000000a', '素の文章') $$,
  '42501', null, '本人でも投稿の表には直接書き込めない');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-00000000000b"}';

select is(
  (select count(*)::int from messages where channel_id = 'c0000000-0000-0000-0000-0000000000aa'),
  1, 'チャンネルの参加者は投稿を読める');

select is(
  (select count(*)::int from message_sources where message_id = 'd0000000-0000-0000-0000-0000000000aa'),
  0, '参加者でも、他人の原文は読めない');

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-00000000000c"}';

select is(
  (select count(*)::int from messages where channel_id = 'c0000000-0000-0000-0000-0000000000aa'),
  0, 'チャンネルの外の人には投稿が見えない');

select is(
  (select count(*)::int from reactions where channel_id = 'c0000000-0000-0000-0000-0000000000aa'),
  0, 'チャンネルの外の人にはリアクションも見えない');

select throws_ok(
  $$ insert into message_sources (message_id, author_id, raw_text) values
     ('d0000000-0000-0000-0000-0000000000aa', 'cccccccc-0000-0000-0000-00000000000c', 'x') $$,
  '42501', null, '原文の表にも直接書き込めない');

select * from finish();
rollback;
