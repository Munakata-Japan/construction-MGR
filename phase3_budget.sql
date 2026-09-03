-- ============================================================
-- 建設統合管理システム  実行予算（材工管理台帳）
-- BUILD: phase3_budget v20260903A
-- ------------------------------------------------------------
-- 工程ごとに必要な部材・外注（材・工）を項目単位で管理する台帳。
-- 見積の単価・数量から出る金額、会社としての予算、実際に決めた
-- 請負金額（決定額）、発注日・納期・納品予定日、納品検査の結果
-- （入数・品質）までを1行にまとめて追える。
-- ------------------------------------------------------------
-- 前提: project_phases, phase_orders まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================


-- ------------------------------------------------------------
-- 1. 材工管理台帳
-- ------------------------------------------------------------
create table if not exists public.phase_budget_items (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  project_id             uuid not null references public.projects(id) on delete cascade,
  phase_id               uuid references public.project_phases(id) on delete set null,

  category               text not null default 'material'
                          check (category in ('material','labor')),   -- 材 / 工
  item_name              text not null,                               -- 項目（材工の内容）
  estimate_partner_id    uuid references public.partners(id) on delete set null,  -- 見積先

  unit_price             numeric,                                     -- 単価
  quantity                numeric,                                     -- 数量
  unit                   text,
  amount                 numeric generated always as
                            (round(coalesce(quantity, 0) * coalesce(unit_price, 0))) stored, -- 金額（単価×数量）

  budget_amount          numeric,                                     -- 会社予算
  contract_amount        numeric,                                     -- 請負金額（決定額）

  order_date             date,                                        -- 発注日
  due_date               date,                                        -- 納期
  scheduled_delivery_date date,                                       -- 納品予定日（作業開始日）
  delivered_on           date,                                        -- 実際に届いた日（検査日）
  delivered_qty          numeric,                                     -- 納品検査：入数
  quality_status         text default 'pending'
                          check (quality_status in ('pending','pass','fail')),  -- 納品検査：品質
  quality_note           text,                                        -- 品質についての備考

  status                 text not null default 'estimate'
                          check (status in ('estimate','ordered','delivered','inspected','cancelled')),

  note                   text,
  seq                    integer not null default 10,
  created_at             timestamptz not null default now(),
  created_by             uuid references public.app_users(id) on delete set null
);

create index if not exists idx_pbi_project on public.phase_budget_items(project_id, phase_id, seq);

comment on table  public.phase_budget_items is '工程ごとの材工管理台帳（実行予算）。見積〜発注〜納品検査までを1行で追う';
comment on column public.phase_budget_items.category is '材料費(material)か外注・労務費(labor)かの区分';
comment on column public.phase_budget_items.amount   is '見積ベースの金額（単価×数量）。自動計算';
comment on column public.phase_budget_items.budget_amount   is '社内で見ている予算額（目標値）';
comment on column public.phase_budget_items.contract_amount is '実際に発注先と決めた請負金額（決定額）';
comment on column public.phase_budget_items.quality_status  is '納品検査の判定：pending=未検査 / pass=良 / fail=否';


-- ------------------------------------------------------------
-- 2. 権限と RLS（発注と同じ考え方）
-- ------------------------------------------------------------
grant select, insert, update, delete on public.phase_budget_items to authenticated;

alter table public.phase_budget_items enable row level security;

drop policy if exists pbi_select on public.phase_budget_items;
create policy pbi_select on public.phase_budget_items
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists pbi_write on public.phase_budget_items;
create policy pbi_write on public.phase_budget_items
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());


-- ------------------------------------------------------------
-- 3. 確認
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_budget_items'
order by ordinal_position;
