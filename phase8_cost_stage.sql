-- ============================================================
-- 宗像総合管理システム  原価の段階（原価台帳／実行予算の区別）
-- BUILD: phase8_cost_stage v20260904A
-- ------------------------------------------------------------
-- 材工項目に「原価の段階」を持たせ、2つの台帳を役割で分ける。
--   estimate = 着工前の見積原価（見積先から取った材工）。原価台帳に載る。
--   extra    = 着工後に発生した副資材・突発費用など、社内人件費を
--              除いて実際に外へ出ていったお金。実行予算のみに載る。
-- 原価台帳 … 工事ごとの estimate 明細（着工前の原価）
-- 実行予算 … estimate ＋ extra の全明細（実支出・損益計算の元）
-- ------------------------------------------------------------
-- 前提: phase3_budget.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.phase_budget_items
  add column if not exists cost_stage text not null default 'estimate'
    check (cost_stage in ('estimate', 'extra'));

comment on column public.phase_budget_items.cost_stage
  is '原価の段階：estimate=着工前の見積原価（原価台帳に載る）／extra=着工後の副資材・突発費用など実支出（実行予算のみ）';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_budget_items'
  and column_name = 'cost_stage';
