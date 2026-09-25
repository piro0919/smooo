-- 使い始めの数問と、どの相手にも使ってよい記憶。
-- 社内で覚えたもの（internal）、社外とのチャンネルで覚えたもの（channel）に加えて、
-- 勤務時間や役割のように、どのチャンネルで使ってもよい記憶（general）を持つ。
-- general は特定の Organization に属さない

alter table public.memories alter column organization_id drop not null;
alter table public.memories drop constraint memories_scope_check;
alter table public.memories drop constraint memories_check;
alter table public.memories
  add constraint memories_scope_check check (scope in ('internal', 'channel', 'general')),
  add constraint memories_shape_check check (
    (scope = 'general' and organization_id is null and channel_id is null)
    or (scope = 'internal' and organization_id is not null and channel_id is null)
    or (scope = 'channel' and organization_id is not null and channel_id is not null)
  );

-- 使い始めの数問に答えたか、飛ばした時刻。null なら、まだ「はじめに」を出す
alter table public.profiles add column onboarded_at timestamptz;
