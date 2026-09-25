-- 訂正。過去の投稿は直さず、訂正の投稿を足す。corrects に、どの投稿を訂正したかを持つ。
-- 訂正できるのは、その投稿に責任を持つ本人だけ。AI が本人の名前で書いた投稿も含む
alter table public.messages
  add column corrects uuid references public.messages (id) on delete set null;
