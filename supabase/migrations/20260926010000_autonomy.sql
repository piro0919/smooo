-- AI が本人に聞かずに答えてよい範囲。各自が選ぶ。
-- careful は覚えていることにそのまま答えがあるときだけ、standard は確実に言えることだけ、
-- trusting は無理なく判断できれば答え、重い判断だけ聞く
alter table public.profiles
  add column autonomy text not null default 'standard'
    check (autonomy in ('careful', 'standard', 'trusting'));
