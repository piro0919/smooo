-- Organization とチャンネルの見える範囲。ここが崩れると、社内だけのはずの
-- チャンネルが社外の人に見えるか、社外の人が入り込める。ポリシーを直接突いて確かめる。
begin;
create extension if not exists pgtap;
select plan(14);

-- A と B は同じ会社、C は社外。サインアップで各自の Organization ができる
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-a@example.test', '{"full_name": "A さん"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'rls-b@example.test', '{}'),
  ('cccccccc-0000-0000-0000-000000000003', 'rls-c@example.test', '{}');

select is(
  (select count(*)::int from organizations o join memberships m on m.organization_id = o.id
   where m.user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and o.personal and m.role = 'owner'),
  1, 'サインアップで本人だけの Organization ができ、owner になる');

select is(
  (select display_name from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'rls-b', '名前がなければメールアドレスの前半を使う');

-- 会社の Organization を作り、A と B を入れる
insert into organizations (id, name) values
  ('0e000000-0000-0000-0000-00000000000a', 'Acme'),
  ('0e000000-0000-0000-0000-00000000000c', 'Other');
insert into memberships (organization_id, user_id, role) values
  ('0e000000-0000-0000-0000-00000000000c', 'cccccccc-0000-0000-0000-000000000003', 'owner');
insert into memberships (organization_id, user_id, role) values
  ('0e000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('0e000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', 'member');

-- A として振る舞う
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001"}';

insert into channels (id, organization_id, name, audience) values
  ('c0000000-0000-0000-0000-000000000001', '0e000000-0000-0000-0000-00000000000a', 'general', 'internal'),
  ('c0000000-0000-0000-0000-000000000002', '0e000000-0000-0000-0000-00000000000a', 'client-x', 'external');

select is(
  (select count(*)::int from channel_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2, 'チャンネルを作った人はそのまま参加者になる');

select throws_ok(
  $$ insert into channels (organization_id, name) values
     ('0e000000-0000-0000-0000-00000000000c', 'intrude') $$,
  '42501', null, '他人の Organization にはチャンネルを作れない');

select throws_ok(
  $$ insert into channel_members (channel_id, user_id) values
     ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501', null, '他人をチャンネルに入れることはまだできない');

-- B として振る舞う
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000002"}';

select is(
  (select count(*)::int from channels where organization_id = '0e000000-0000-0000-0000-00000000000a'),
  2, '同じ Organization の人は、入っていないチャンネルも一覧で見える');

select lives_ok(
  $$ insert into channel_members (channel_id, user_id) values
     ('c0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '同じ Organization のチャンネルには自分で入れる');

select is(
  (select display_name from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'A さん', '同じ Organization の人の名前は見える');

-- C として振る舞う。社外の人
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000003"}';

select is(
  (select count(*)::int from channels where organization_id = '0e000000-0000-0000-0000-00000000000a'),
  0, '社外の人には、入っていないチャンネルは見えない');

select is(
  (select count(*)::int from organizations where id = '0e000000-0000-0000-0000-00000000000a'),
  0, '社外の人には、よその Organization は見えない');

select is(
  (select count(*)::int from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0, '接点のない人の名前は見えない');

select throws_ok(
  $$ insert into channel_members (channel_id, user_id) values
     ('c0000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003') $$,
  '42501', null, '社外の人は、社外も入れるチャンネルにも自分では入れない');

-- 招待の経路ができても、社内だけのチャンネルに社外の人は入れない。
-- ポリシーを通らない権限で直接入れて、トリガーが止めることを確かめる
reset role;

select throws_ok(
  $$ insert into channel_members (channel_id, user_id) values
     ('c0000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003') $$,
  '23514', 'outsiders cannot join an internal channel', '社内だけのチャンネルに社外の人は入れない');

insert into channel_members (channel_id, user_id) values
  ('c0000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000003"}';

select is(
  (select array_agg(name order by name) from channels where organization_id = '0e000000-0000-0000-0000-00000000000a'),
  array['client-x'], '招待された社外の人には、そのチャンネルだけが見える');

select * from finish();
rollback;
