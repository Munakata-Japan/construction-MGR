-- ============================================================
--  phase18_actual_cost.sql  原価の実績締め・損益（RE3）
--  ------------------------------------------------------------
--  発注確定・検収で「実際原価」を確定し、売上(請負金額)と突き合わせて
--  粗利を締めるための土台。非破壊・冪等（何度実行しても安全）。
--  ※ 支払（振込・入金）は扱いません。ここで扱うのは原価・粗利のみ。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

-- 1) 品目ごとの「実際原価」と「検収日」
--    actual_amount = 検収で確定した実際原価（未検収は null＝見込みで扱う）
--    inspected_on  = 検収した日
alter table public.phase_budget_items add column if not exists actual_amount numeric;
alter table public.phase_budget_items add column if not exists inspected_on  date;

-- 2) 工事ごとの「損益を締めた」記録（締め後は確定表示・再オープン可）
alter table public.projects add column if not exists profit_closed_at timestamptz;
alter table public.projects add column if not exists profit_closed_by uuid;

notify pgrst, 'reload schema';
