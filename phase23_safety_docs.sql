-- phase23_safety_docs.sql
-- 安全書類（提出済みの実ファイル）を「工事 × 日付 × 書類種別」で保管し、
-- 社内・社外（協力業者）を含む同じ組織の全員が閲覧できるようにする。
-- ファイル本体は既存のストレージ（バケット project-files）の
--   <organization_id>/safety/... に保存し、その参照をこの表に持つ。

create table if not exists public.site_safety_docs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default current_org_id(),
  project_id      uuid references public.projects(id) on delete set null,
  doc_type        text not null default 'その他',   -- KY活動表 / 新規入場者教育 / TBM(安全朝礼) / 安全パトロール / ヒヤリハット・災害報告 / 作業員名簿 / 施工体制図 / 労災保険関係 / その他
  doc_date        date,                              -- 書類の日付（KYなど毎日ものはこの日付で並ぶ）
  title           text,
  note            text,
  storage_path    text not null,                     -- 例: <org>/safety/<project|common>/<stamp>_<name>
  original_name   text,
  mime_type       text,
  byte_size       bigint,
  uploaded_by     uuid,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_safety_docs_org  on public.site_safety_docs(organization_id);
create index if not exists idx_safety_docs_proj on public.site_safety_docs(project_id);
create index if not exists idx_safety_docs_date on public.site_safety_docs(doc_date);

alter table public.site_safety_docs enable row level security;

-- 閲覧：同じ組織の全員（社外＝協力業者・外注も含む）
drop policy if exists safety_docs_select on public.site_safety_docs;
create policy safety_docs_select on public.site_safety_docs
  for select using (organization_id = current_org_id());

-- 追加・更新・削除：経営者／現場監督（管理者）のみ
drop policy if exists safety_docs_insert on public.site_safety_docs;
create policy safety_docs_insert on public.site_safety_docs
  for insert with check (organization_id = current_org_id() and is_manager_or_admin());

drop policy if exists safety_docs_update on public.site_safety_docs;
create policy safety_docs_update on public.site_safety_docs
  for update using (organization_id = current_org_id() and is_manager_or_admin());

drop policy if exists safety_docs_delete on public.site_safety_docs;
create policy safety_docs_delete on public.site_safety_docs
  for delete using (organization_id = current_org_id() and is_manager_or_admin());
