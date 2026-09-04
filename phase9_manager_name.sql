-- ============================================================
-- 宗像総合管理システム  現場担当を氏名テキストで持つ
-- BUILD: phase9_manager_name v20260904A
-- ------------------------------------------------------------
-- 現場代理人・主任技術者と同じく、現場担当も自由入力（氏名）に
-- 統一するための列。既存の manager_user_id（利用者への紐づけ）は
-- 残すが、画面では manager_name を使う（日報・写真の現場責任者は
-- manager_name 優先、無ければ従来の利用者名で表示）。
-- ------------------------------------------------------------
-- 前提: projects まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.projects
  add column if not exists manager_name text;

comment on column public.projects.manager_name
  is '現場担当の氏名（自由入力）。現場代理人・主任技術者と同じ扱い';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
  and column_name = 'manager_name';
