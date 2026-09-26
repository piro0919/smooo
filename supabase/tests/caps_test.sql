-- 投稿数の上限。枠を引く会社の決まり方と、使用数を見られる人
begin;
create extension if not exists pgtap;
select plan(5);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'cap-a@example.test'),
  ('cccccccc-0000-0000-0000-0000000000c3', 'cap-c@example.test');
insert into organizations (id, name, post_cap) values ('0e000000-0000-0000-0000-0000000000c0', 'Acme', 2);
insert into memberships (organization_id, user_id) values
  ('0e000000-0000-0000-0000-0000000000c0', 'aaaaaaaa-0000-0000-0000-0000000000c1');
insert into channels (id, organization_id, name, audience, created_by) values
  ('c0000000-0000-0000-0000-0000000000c0', '0e000000-0000-0000-0000-0000000000c0', 'client', 'external',
   'aaaaaaaa-0000-0000-0000-0000000000c1');
insert into channel_members (channel_id, user_id) values
  ('c0000000-0000-0000-0000-0000000000c0', 'cccccccc-0000-0000-0000-0000000000c3');

select is(public.billing_org_for('aaaaaaaa-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c0'),
  '0e000000-0000-0000-0000-0000000000c0'::uuid, '社員の投稿は、そのチャンネルの会社の枠から引く');
select is(public.billing_org_for('cccccccc-0000-0000-0000-0000000000c3', 'c0000000-0000-0000-0000-0000000000c0'),
  (select organization_id from memberships where user_id = 'cccccccc-0000-0000-0000-0000000000c3'),
  '社外の人の投稿は、その人の会社の枠から引く');

insert into messages (channel_id, author_id, body, billed_org_id) values
  ('c0000000-0000-0000-0000-0000000000c0', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'one', '0e000000-0000-0000-0000-0000000000c0'),
  ('c0000000-0000-0000-0000-0000000000c0', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'two', '0e000000-0000-0000-0000-0000000000c0');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000c1", "role": "authenticated"}';
select results_eq($$ select used, cap from public.post_usage('0e000000-0000-0000-0000-0000000000c0') $$,
  $$ values (2, 2) $$, '会社の人には今月の使用数と上限が見える');
select throws_ok($$ select public.billing_org_for('aaaaaaaa-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-0000000000c0') $$,
  '42501', null, '枠の決め方はサーバーだけが呼べる');

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-0000000000c3", "role": "authenticated"}';
select is((select count(*)::int from public.post_usage('0e000000-0000-0000-0000-0000000000c0')), 0,
  '社外の人には、よその会社の使用数は見えない');

select * from finish();
rollback;
