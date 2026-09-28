-- ============================================================
-- 宗像総合管理システム  開発者アカウントの目印
-- BUILD: phase7_developer_flag v20260904A
-- ------------------------------------------------------------
-- デモで社員に画面を見せる際、開発者（保守担当）のアカウントの
-- 本名を出したくない。is_developer を true にした利用者は、
-- 利用者一覧や上長の選択肢で本名の代わりに「開発者」と表示し、
-- 一覧では常に最下部に並べる。
-- ------------------------------------------------------------
-- 前提: app_users まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ------------------------------------------------------------
-- 反映のしかた: 実行後、利用者ページで対象アカウント（例：栗本）を
-- 開き、「開発者アカウント」にチェックを入れて保存すれば切り替わる。
-- （SQLで直接 true にする必要はない）
-- ============================================================

alter table public.app_users
  add column if not exists is_developer boolean not null default false;

comment on column public.app_users.is_developer
  is 'trueなら開発者アカウント。利用者一覧では本名の代わりに「開発者」と表示し、最下部に固定する（デモ時に本名を出さないため）';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'app_users'
  and column_name = 'is_developer';
