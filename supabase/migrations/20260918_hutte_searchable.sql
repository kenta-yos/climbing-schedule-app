-- ジム名に読みを添えて、日本語で検索できるようにする。
--
-- ジム検索は gym_name の単純な部分一致（PlanPageClient の filteredGyms）。
-- 「Climbing GYM Hütte」は ü が入るため「ヒュッテ」でも「hutte」でも引けない。
-- 店名としての表記は残したいので、末尾に読みを足して検索にだけ効かせる。
--
-- gym_master が正、climbing_logs / set_schedules は gym_name を文字列で持つので
-- 同じ値に揃える。work_shifts と plan_events には参照が無い（確認済み）。
--
-- 2026-09-18 に本番へ適用済み（climbing_logs 21 行 / set_schedules 1 行 / gym_master 1 行）。
-- ここには記録として残す。

begin;

update public.climbing_logs
   set gym_name = 'Climbing GYM Hütte（ヒュッテ）'
 where gym_name = 'Climbing GYM Hütte';

update public.set_schedules
   set gym_name = 'Climbing GYM Hütte（ヒュッテ）'
 where gym_name = 'Climbing GYM Hütte';

update public.gym_master
   set gym_name = 'Climbing GYM Hütte（ヒュッテ）'
 where gym_name = 'Climbing GYM Hütte';

commit;
