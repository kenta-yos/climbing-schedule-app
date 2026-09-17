-- 重複していたジムマスタの統合と、名前に紛れ込んだ不可視文字の掃除。
--
-- 1. 「ヒュッテ」と「Climbing GYM  Hütte」(先頭に U+200B)は同じジム。Instagram が同じアカウント
--    （climbinggym_hutte）を指し、緯度経度もほぼ一致する。実績 21 件が付いている
--    後者に寄せ、参照が 1 件も無い「ヒュッテ」をマスタから消す。
--
-- 2. 残す側の名前には先頭にゼロ幅スペース（U+200B）が入っており、GYM と Hütte の
--    間も半角スペース 2 つだった。一覧で先頭に並んでしまい、手で打っても検索に
--    引っかからない。Dai が別名で登録し直したのもこれが原因と思われるので直す。
--
-- page_views の action に残る旧名は書き換えない。起きたことの記録であり、当時は
-- 実際にその名前で登録されている。効果測定の数字にも影響しない。

begin;

-- 念のため、消す側にデータの参照が無いことを確かめる。1 件でもあれば中断する
do $$
declare
  refs int;
begin
  select
    (select count(*) from public.climbing_logs where gym_name = 'ヒュッテ')
  + (select count(*) from public.work_shifts   where gym_name = 'ヒュッテ')
  + (select count(*) from public.plan_events   where gym_name = 'ヒュッテ'
                                                  or prev_gym_name = 'ヒュッテ')
  + (select count(*) from public.set_schedules where gym_name = 'ヒュッテ')
  into refs;
  if refs <> 0 then
    raise exception '「ヒュッテ」に % 件の参照が残っている。移行してから消すこと', refs;
  end if;
end $$;

delete from public.gym_master where gym_name = 'ヒュッテ';

-- U+200B とスペース 2 つを取り除く。chr(8203) がゼロ幅スペースで、
-- 旧名はこれを先頭に、GYM と Hütte の間に半角スペース 2 つを持つ
update public.climbing_logs
   set gym_name = 'Climbing GYM Hütte'
 where gym_name = chr(8203) || 'Climbing GYM  Hütte';

update public.set_schedules
   set gym_name = 'Climbing GYM Hütte'
 where gym_name = chr(8203) || 'Climbing GYM  Hütte';

update public.gym_master
   set gym_name = 'Climbing GYM Hütte'
 where gym_name = chr(8203) || 'Climbing GYM  Hütte';

commit;
