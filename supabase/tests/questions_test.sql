-- 質問は聞かれた本人だけが読め、記憶は誰も読めない。記憶が見えると
-- 「覚えたことは画面に出さない」が崩れ、他人の答えが漏れる
begin;
create extension if not exists pgtap;
select plan(5);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'q-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-0000000000f2', 'q-b@example.test');

insert into organizations (id, name) values ('0e000000-0000-0000-0000-0000000000f0', 'Acme');
insert into memberships (organization_id, user_id) values
  ('0e000000-0000-0000-0000-0000000000f0', 'aaaaaaaa-0000-0000-0000-0000000000f1'),
  ('0e000000-0000-0000-0000-0000000000f0', 'bbbbbbbb-0000-0000-0000-0000000000f2');
insert into channels (id, organization_id, name, created_by) values
  ('c0000000-0000-0000-0000-0000000000f0', '0e000000-0000-0000-0000-0000000000f0', 'general',
   'aaaaaaaa-0000-0000-0000-0000000000f1');
insert into messages (id, channel_id, author_id, body) values
  ('d0000000-0000-0000-0000-0000000000f0', 'c0000000-0000-0000-0000-0000000000f0',
   'aaaaaaaa-0000-0000-0000-0000000000f1', '来週の水曜は空いていますか。');
insert into questions (user_id, message_id, channel_id, prompt, options, deadline) values
  ('bbbbbbbb-0000-0000-0000-0000000000f2', 'd0000000-0000-0000-0000-0000000000f0',
   'c0000000-0000-0000-0000-0000000000f0', '来週の水曜は空いていますか', '["空いている", "空いていない"]', now() + interval '1 day');
insert into memories (user_id, organization_id, scope, content) values
  ('bbbbbbbb-0000-0000-0000-0000000000f2', '0e000000-0000-0000-0000-0000000000f0', 'internal', '水曜の午後は外出が多い');

set local role authenticated;

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-0000000000f2"}';
select is((select count(*)::int from questions), 1, '聞かれた本人は質問を読める');
select is((select count(*)::int from memories), 0, '本人でも、自分の記憶は読めない');
update questions set status = 'answered', answer = 'x';
select is((select status from questions), 'open', '質問への答えは直接書き込めない');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000f1"}';
select is((select count(*)::int from questions), 0, 'ほかの人への質問は読めない');
select throws_ok(
  $$ insert into memories (user_id, organization_id, scope, content) values
     ('aaaaaaaa-0000-0000-0000-0000000000f1', '0e000000-0000-0000-0000-0000000000f0', 'internal', 'x') $$,
  '42501', null, '記憶は直接書き込めない');

select * from finish();
rollback;
