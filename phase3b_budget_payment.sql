-- ============================================================
-- 建設統合管理システム  実行予算：支払状況
-- BUILD: phase3b_budget_payment v20260903A
-- ------------------------------------------------------------
-- 経理処理（請求書の受領・消込など）は本システムの対象外だが、
-- 支払状況は納期・発注判断に関わる情報のため、簡易な状態として
-- 台帳に持たせる。
-- ------------------------------------------------------------
-- 前提: phase3_budget.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.phase_budget_items
  add column if not exists payment_status text not null default 'unscheduled'
    check (payment_status in ('unscheduled', 'partial', 'paid'));
    -- unscheduled=支払未定 / partial=支払残あり / paid=支払済

alter table public.phase_budget_items
  add column if not exists paid_amount numeric;   -- 支払済金額（支払残 = 決定額 − この値）

comment on column public.phase_budget_items.payment_status
  is '支払状況：unscheduled=支払未定／partial=支払残あり／paid=支払済（経理の消込ではなく、参考の状態管理）';
comment on column public.phase_budget_items.paid_amount
  is '支払済金額。請負金額（決定額）との差が支払残になる';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_budget_items'
  and column_name in ('payment_status', 'paid_amount');
