-- AI 同士の往復の深さ。人間の投稿は 0、それに AI が返せば 1、その AI の返事に別の AI が返せば 2。
-- 一定の深さで止め、往復が止まらなくなるのを防ぐ
alter table public.messages add column depth int not null default 0;
