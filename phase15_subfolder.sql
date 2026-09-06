-- ============================================================
--  phase15_subfolder.sql  竣工図書：章の中のサブフォルダ
--  ------------------------------------------------------------
--  各章(doc_category)の中で、さらにサブフォルダ(doc_subcategory)へ分けられるようにする。
--  NULL/空＝章の直下。サブフォルダ名は自由入力（章ごとに独立）。
--  新テーブルは作らず、project_files に1列足すだけ。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

alter table public.project_files
  add column if not exists doc_subcategory text;

comment on column public.project_files.doc_subcategory is
  '章(doc_category)内のサブフォルダ名。NULL/空=章の直下。handover.html で分ける。';

create index if not exists project_files_subcat_idx
  on public.project_files (project_id, doc_category, doc_subcategory, sort_order);
