-- ============================================================
-- 宗像総合管理システム  写真・書類に担当者と日報リンクを持たせる
-- BUILD: phase12_report_files v20260904A
-- ------------------------------------------------------------
-- 目的：写真・書類を「現場別・担当別」に辿れるようにする。
--   ・assignee_name   … その資料の担当者（現場で撮った人・作業した人）の氏名。
--                       日報に添付したものは日報の担当者を自動で入れる。
--                       PCから直接上げたもの・既存分は手で選ぶ／入力できる。
--                       （※ uploaded_by は「取り込んだ人」で担当者とは別物）
--   ・daily_report_id … その資料が「どの作業日報の分か」。これで
--                       日報＋写真＋書類が1つの束になり、日報から現場・担当・
--                       日付をたどれる。日報を消しても資料は残す（set null）。
-- ------------------------------------------------------------
-- 前提: project_files / daily_reports まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.project_files
  add column if not exists assignee_name text;

alter table public.project_files
  add column if not exists daily_report_id uuid
  references public.daily_reports(id) on delete set null;

create index if not exists project_files_daily_report_id_idx
  on public.project_files(daily_report_id);

comment on column public.project_files.assignee_name
  is '担当者の氏名（現場で撮影・作業した人）。日報に添付すると日報の担当者を自動で入れる。uploaded_by（取込者）とは別';
comment on column public.project_files.daily_report_id
  is '紐づく作業日報。日報＋写真＋書類を1つの束にする。日報削除時は null（資料は残す）';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'project_files'
  and column_name in ('assignee_name','daily_report_id')
order by column_name;
