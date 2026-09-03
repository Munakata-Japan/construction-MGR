-- ============================================================
-- 建設統合管理システム  発注の商材明細（金額・数量）
-- BUILD: phase2_order_items v20260903A
-- ------------------------------------------------------------
-- これまでの「発注・依頼」は内容（タイトル）と期限・状態だけを
-- 管理していた。見積書のような品名・数量・単価・金額の明細と、
-- 発注全体の合計金額をあわせて管理できるようにする。
-- ------------------------------------------------------------
-- 前提: phase_orders テーブルまで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================


-- ------------------------------------------------------------
-- 1. 発注に合計金額を持たせる
--    （商材明細の保存時に、クライアント側で合計してまとめて入れる）
-- ------------------------------------------------------------
alter table public.phase_orders add column if not exists total_amount numeric;

comment on column public.phase_orders.total_amount
  is '商材明細（phase_order_items）の合計金額。明細の保存のたびに計算して入れ直す';


-- ------------------------------------------------------------
-- 2. 商材明細
-- ------------------------------------------------------------
create table if not exists public.phase_order_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phase_order_id  uuid not null references public.phase_orders(id) on delete cascade,
  seq             integer not null default 10,
  item_name       text not null,
  quantity        numeric,
  unit            text,
  unit_price      numeric,
  amount          numeric generated always as (round(coalesce(quantity, 0) * coalesce(unit_price, 0))) stored,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_poi_order
  on public.phase_order_items(phase_order_id, seq);

comment on table  public.phase_order_items is '発注1件に紐づく商材の明細行（見積明細書の1行に相当）';
comment on column public.phase_order_items.item_name  is '品名・規格（例：ケーブル支持金具（適用径：Φ55））';
comment on column public.phase_order_items.amount     is '数量×単価。保存時に自動計算される';
comment on column public.phase_order_items.note       is 'メーカー名や備考';


-- ------------------------------------------------------------
-- 3. 権限と RLS（phase_orders と同じ考え方：閲覧は組織内、
--    書き込みは現場監督・管理者のみ）
-- ------------------------------------------------------------
grant select, insert, update, delete on public.phase_order_items to authenticated;

alter table public.phase_order_items enable row level security;

drop policy if exists poi_select on public.phase_order_items;
create policy poi_select on public.phase_order_items
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists poi_write on public.phase_order_items;
create policy poi_write on public.phase_order_items
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());


-- ------------------------------------------------------------
-- 4. 確認
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'phase_order_items'
order by ordinal_position;
