-- アイコンの画像は、自分のフォルダにしか置けない。他人のアイコンを差し替えられたら、なりすましになる
begin;
create extension if not exists pgtap;
select plan(2);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-0000000000a9', 'av-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-0000000000b9', 'av-b@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-0000000000a9", "role": "authenticated"}';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'aaaaaaaa-0000-0000-0000-0000000000a9/me.png', 'aaaaaaaa-0000-0000-0000-0000000000a9') $$,
  '自分のフォルダには置ける');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'bbbbbbbb-0000-0000-0000-0000000000b9/me.png', 'aaaaaaaa-0000-0000-0000-0000000000a9') $$,
  '42501', null, '他人のフォルダには置けない');

select * from finish();
rollback;
