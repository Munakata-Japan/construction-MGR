-- ============================================================
-- 宗像総合管理システム  着工前原価台帳を工種でカテゴリ分けする
-- BUILD: phase13_discipline v20260904A
-- ------------------------------------------------------------
-- 目的：購入資材などの明細を「土木工事」「電気工事」などの工種で
-- 仕分けられるようにする。着工前原価台帳(genka)で行をドラッグして
-- 工種セクションへ入れ、並べ替えもできるようにするための2列。
--   discipline … 工種の名称（'土木工事' / '電気工事' / '共通' など。自由文字列）。
--                未設定は「未分類」として扱う。
--   sort_order … 台帳内での並び順（ドラッグで並べ替えた結果を保存）。小さいほど上。
-- ------------------------------------------------------------
-- 前提: phase_budget_items まで作成済み（phase3_budget.sql）
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.phase_budget_items
  add column if not exists discipline text;

alter table public.phase_budget_items
  add column if not exists sort_order integer not null default 0;

comment on column public.phase_budget_items.discipline
  is '工種の名称（土木工事 / 電気工事 / 共通 など・自由文字列）。着工前原価台帳のカテゴリ分けに使う。未設定＝未分類';
comment on column public.phase_budget_items.sort_order
  is '台帳内の並び順（ドラッグ並べ替えの保存先）。小さいほど上';


-- 確認
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_budget_items'
  and column_name in ('discipline','sort_order')
order by column_name;
