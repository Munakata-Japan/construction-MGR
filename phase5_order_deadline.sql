-- ============================================================
-- 建設統合管理システム  材工項目：発注リードタイム（発注期限アラート用）
-- BUILD: phase5_order_deadline v20260903A
-- ------------------------------------------------------------
-- 発注品目ごとに「発注してから納品されるまでの目安日数」を持たせ、
-- 納品予定日から逆算した発注期限を、工程表のガントバー上で
-- アラート表示するために使う（金額には一切関係しない）。
-- ------------------------------------------------------------
-- 前提: phase3_budget.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.phase_budget_items
  add column if not exists lead_time_days integer;

comment on column public.phase_budget_items.lead_time_days
  is '発注してから納品されるまでの目安日数（リードタイム）。納品予定日から逆算して発注期限を出すために使う';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_budget_items'
  and column_name = 'lead_time_days';
