-- ============================================================
--  phase14_handover.sql  竣工図書のための「図書分類」と「並び順」
--  ------------------------------------------------------------
--  写真・書類（project_files）に、竣工図書のどの章に綴じるか(doc_category)と、
--  章の中での並び順(sort_order)を持たせる。新テーブルは作らず、
--  既存の project_files（RLS 設定済み）へ2列足すだけ。
--  Supabase の SQL Editor で1回実行してください。
-- ============================================================

alter table public.project_files
  add column if not exists doc_category text,
  add column if not exists sort_order   integer not null default 0;

comment on column public.project_files.doc_category is
  '竣工図書の章（common.js の HANDOVER_CHAPTERS のキー）。handover.html で割り当てる。';
comment on column public.project_files.sort_order is
  '章の中での並び順。handover.html のドラッグ並べ替えで採番（10刻み）。';

-- 章ごと・並び順の取り出しを速くする
create index if not exists project_files_doc_category_idx
  on public.project_files (project_id, doc_category, sort_order);
