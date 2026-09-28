-- ============================================================
--  phase17_estimate_quotes.sql  相見積（原価を決める過程）
--  ------------------------------------------------------------
--  4社見積合わせ→業者決定→着工前原価確定 のための土台。
--  非破壊・冪等（何度実行しても安全）。既存テーブルは変更しない。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

-- 1) 見積内訳(phase_budget_items)に、見積先ごと(最大4社)の金額をぶら下げる
create table if not exists public.budget_item_quotes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id      uuid not null,
  budget_item_id  uuid not null references public.phase_budget_items(id) on delete cascade,
  partner_id      uuid,             -- 見積先（協力会社・資材業者）
  unit_price      numeric,          -- 各社の単価
  amount          numeric,          -- 各社の金額（数量×単価。手入力も可）
  note            text,
  created_at      timestamptz default now()
);
create index if not exists budget_item_quotes_item_idx on public.budget_item_quotes(budget_item_id);
create index if not exists budget_item_quotes_proj_idx on public.budget_item_quotes(project_id);
-- 同じ品目に同じ見積先は1行だけ（採用の付け替え・入れ直しがしやすい）
create unique index if not exists budget_item_quotes_uni on public.budget_item_quotes(budget_item_id, partner_id);

alter table public.budget_item_quotes enable row level security;
grant select, insert, update, delete on public.budget_item_quotes to authenticated;
drop policy if exists biq_select on public.budget_item_quotes;
create policy biq_select on public.budget_item_quotes for select
  using (organization_id = current_org_id());
drop policy if exists biq_write on public.budget_item_quotes;
create policy biq_write on public.budget_item_quotes for all
  using (organization_id = current_org_id() and is_manager_or_admin())
  with check (organization_id = current_org_id() and is_manager_or_admin());

-- 2) 各見積先の見積書ファイル（工事×見積先ごとに添付）
create table if not exists public.estimate_quote_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id      uuid not null,
  partner_id      uuid,
  storage_path    text not null,    -- project-files バケット内のパス
  original_name   text,
  byte_size       bigint,
  mime_type       text,
  uploaded_by     uuid,
  created_at      timestamptz default now()
);
create index if not exists estimate_quote_files_proj_idx on public.estimate_quote_files(project_id);

alter table public.estimate_quote_files enable row level security;
grant select, insert, update, delete on public.estimate_quote_files to authenticated;
drop policy if exists eqf_select on public.estimate_quote_files;
create policy eqf_select on public.estimate_quote_files for select
  using (organization_id = current_org_id());
drop policy if exists eqf_write on public.estimate_quote_files;
create policy eqf_write on public.estimate_quote_files for all
  using (organization_id = current_org_id() and is_manager_or_admin())
  with check (organization_id = current_org_id() and is_manager_or_admin());

notify pgrst, 'reload schema';
