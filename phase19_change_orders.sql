-- ============================================================
--  phase19_change_orders.sql  設計変更・追加工事（変更契約）RE5
--  ------------------------------------------------------------
--  当初契約はそのままに、変更（追加/減額）を別テーブルで積み上げる。
--  変更後請負金額 = 当初 contract_amount ＋ 承認済み変更の売上増減合計。
--  変更に紐づく「追加原価」は phase_budget_items(cost_stage='extra') を
--  change_order_id で紐づけて計上する。非破壊・冪等。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

-- 1) 工事ごとの変更契約
create table if not exists public.project_change_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id      uuid not null,
  change_no       integer,          -- 変更No（工事内の連番）
  title           text,             -- 件名
  sales_delta     numeric,          -- 売上増減（客先への追加/減額請求・税抜。減額はマイナス）
  status          text default 'estimate' check (status in ('estimate','approved','rejected')),
  decided_on      date,             -- 客先が承認/却下した日
  note            text,
  created_at      timestamptz default now(),
  created_by      uuid
);
create index if not exists project_change_orders_proj_idx on public.project_change_orders(project_id);

alter table public.project_change_orders enable row level security;
grant select, insert, update, delete on public.project_change_orders to authenticated;
drop policy if exists pco_select on public.project_change_orders;
create policy pco_select on public.project_change_orders for select
  using (organization_id = current_org_id());
drop policy if exists pco_write on public.project_change_orders;
create policy pco_write on public.project_change_orders for all
  using (organization_id = current_org_id() and is_manager_or_admin())
  with check (organization_id = current_org_id() and is_manager_or_admin());

-- 2) 追加品目（原価）がどの変更契約に紐づくか
alter table public.phase_budget_items add column if not exists change_order_id uuid;

notify pgrst, 'reload schema';
