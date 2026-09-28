-- ============================================================
-- 建設統合管理システム  実行予算：2026-001（2M村山市蓄電所）
-- 予算・決定額を金額と同額にそろえる（差額をゼロにする）
-- BUILD: phase3d_budget_set_amounts_2026-001 v20260903A
-- ------------------------------------------------------------
-- 65件すべての行について、
--   会社予算（budget_amount）   = 金額（amount = 単価×数量）
--   請負金額・決定額（contract_amount） = 金額（amount）
-- とし、差額（予算－決定額）が発生しない状態にする。
-- ------------------------------------------------------------
-- 前提: phase3_budget.sql / phase3c_budget_seed_2026-001.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

update public.phase_budget_items
set budget_amount = amount,
    contract_amount = amount
where project_id = (
  select id from public.projects where project_no = '2026-001'
);


-- 確認：件数と、差額が残っている行がないこと
select
  count(*) as 件数,
  count(*) filter (where budget_amount is distinct from contract_amount) as 差額あり件数,
  sum(amount) as 金額合計,
  sum(budget_amount) as 予算合計,
  sum(contract_amount) as 決定額合計
from public.phase_budget_items pbi
join public.projects p on p.id = pbi.project_id
where p.project_no = '2026-001';
