-- ============================================================
--  phase22_hourensou.sql  報・連・相（現場→本社上役の日次報告）
--  ------------------------------------------------------------
--  現場の状況を「報告(成果)／連絡(問題点)／相談(重要・遅れ直結)」で
--  日々投稿し、本社が確認・返信して双方で確認する。全ログを残し検索可。
--  投稿・返信は組織メンバー全員が可能。確認/状態変更/削除はアプリ側で
--  本社(管理者・現場監督)に限定して表示する。非破壊・冪等。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

-- 1) 報・連・相 本体
create table if not exists public.site_reports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id      uuid,                 -- どの工事か（工事全体なら null 可）
  report_type     text not null default 'report'
                   check (report_type in ('report','contact','consult')),
                   -- report=報告(成果・進み具合) / contact=連絡(問題点) / consult=相談(重要)
  title           text,                 -- 見出し（検索対象）
  body            text,                 -- 内容
  status          text default 'open'
                   check (status in ('open','in_progress','resolved')),
                   -- 未対応 → 対応中 → 解決（主に連絡・相談）
  acknowledged_by uuid,                 -- 本社が確認した人
  acknowledged_at timestamptz,          -- 本社が確認した日時
  created_by      uuid,                 -- 投稿者
  created_at      timestamptz default now(),
  is_active       boolean default true
);
create index if not exists site_reports_org_idx  on public.site_reports(organization_id);
create index if not exists site_reports_proj_idx on public.site_reports(project_id);
create index if not exists site_reports_created_idx on public.site_reports(created_at);

alter table public.site_reports enable row level security;
grant select, insert, update, delete on public.site_reports to authenticated;
drop policy if exists sr_select on public.site_reports;
create policy sr_select on public.site_reports for select
  using (organization_id = current_org_id());
drop policy if exists sr_write on public.site_reports;
create policy sr_write on public.site_reports for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

-- 2) 返信（本社の回答・現場の追記）
create table if not exists public.site_report_replies (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_id       uuid not null,
  body            text,
  created_by      uuid,
  created_at      timestamptz default now()
);
create index if not exists site_report_replies_report_idx on public.site_report_replies(report_id);

alter table public.site_report_replies enable row level security;
grant select, insert, update, delete on public.site_report_replies to authenticated;
drop policy if exists srr_select on public.site_report_replies;
create policy srr_select on public.site_report_replies for select
  using (organization_id = current_org_id());
drop policy if exists srr_write on public.site_report_replies;
create policy srr_write on public.site_report_replies for all
  using (organization_id = current_org_id())
  with check (organization_id = current_org_id());

-- 3) 添付ファイル（画像・Word・Excel・PDF等）は既存の project_files を流用し、
--    どの報・連・相に紐づくかを持たせる（投稿を消しても資料は残す）。
alter table public.project_files add column if not exists site_report_id uuid;
create index if not exists project_files_site_report_idx on public.project_files(site_report_id);

notify pgrst, 'reload schema';
