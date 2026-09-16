-- phase24_contracts.sql
-- 契約関係（受注＝クライアントとの請負契約 / 発注書＝協力会社への発注契約）を
-- このシステムに統合して保管する。契約書PDF本体は既存ストレージ（バケット
-- project-files）の <organization_id>/contracts/... に保存し、その参照と要点を
-- この表に持つ（＝新しい保管場所「契約書」）。
-- AI要点整理（契約書の重要ポイント抽出）の結果は ai_summary(jsonb) に保存。
-- 閲覧・編集は経営者／現場監督（①②）のみ（金額・契約条件を含むため）。
-- 非破壊・冪等。Supabase の SQL Editor で1回実行してください。

create table if not exists public.contracts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_org_id(),
  kind            text not null default 'received',   -- received=受注(クライアント) / issued=発注書(協力会社)
  project_id      uuid references public.projects(id) on delete set null,
  partner_id      uuid references public.partners(id) on delete set null,  -- 相手先（クライアント or 協力会社）
  counterparty    text,                                -- 相手先名（取引先未登録でも自由記入できる）
  title           text,                                -- 契約名（例：〇〇蓄電所 電気工事 請負契約書）
  contract_no     text,                                -- 契約番号・注文番号
  contract_amount numeric,                             -- 請負金額（税抜/記載のまま。支払処理はしない＝表示のみ）
  tax_included    boolean,                             -- 金額が税込か
  contract_date   date,                                -- 契約日
  period_start    date,                                -- 工期（着工）
  period_end      date,                                -- 工期（完成）
  storage_path    text,                                -- 例: <org>/contracts/<received|issued>/<stamp>_<name>
  original_name   text,
  mime_type       text,
  byte_size       bigint,
  ai_summary      jsonb,                               -- AI要点整理 { points:[{label,value}], notes }
  ai_summary_at   timestamptz,
  note            text,
  seq             integer,
  is_active       boolean not null default true,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contracts_org   on public.contracts(organization_id);
create index if not exists idx_contracts_kind  on public.contracts(kind);
create index if not exists idx_contracts_proj  on public.contracts(project_id);
create index if not exists idx_contracts_part  on public.contracts(partner_id);

alter table public.contracts enable row level security;

-- 閲覧・追加・更新・削除：経営者／現場監督（①②）のみ
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select using (organization_id = current_org_id() and is_manager_or_admin());

drop policy if exists contracts_insert on public.contracts;
create policy contracts_insert on public.contracts
  for insert with check (organization_id = current_org_id() and is_manager_or_admin());

drop policy if exists contracts_update on public.contracts;
create policy contracts_update on public.contracts
  for update using (organization_id = current_org_id() and is_manager_or_admin());

drop policy if exists contracts_delete on public.contracts;
create policy contracts_delete on public.contracts
  for delete using (organization_id = current_org_id() and is_manager_or_admin());

notify pgrst, 'reload schema';

-- 確認
select 'contracts table ready' as status;
