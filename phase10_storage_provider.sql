-- ============================================================
-- 宗像総合管理システム  写真・書類の「保存先」を1件ごとに記録
-- BUILD: phase10_storage_provider v20260904A
-- ------------------------------------------------------------
-- 目的：将来 写真の実体を別クラウド（Cloudflare R2 / Backblaze B2 など）へ
-- 移しても齟齬が出ないようにする。ファイル1件ごとに「どこに保存したか」を
-- 覚えておき、読み出し（署名URL）はこの値で出し分ける前提とする。
--   ・既定は 'supabase'（今までの Storage バケット project-files）
--   ・保存先を変えるのは これから上げる新しいファイルだけ。
--     既存レコードは動かさない＝古い写真も新しい写真も両方開ける（混在OK）。
-- ------------------------------------------------------------
-- 前提: project_files テーブルまで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.project_files
  add column if not exists storage_provider text not null default 'supabase';

-- 想定外の値が入らないようにする（supabase / r2 / b2）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_files_storage_provider_chk'
  ) then
    alter table public.project_files
      add constraint project_files_storage_provider_chk
      check (storage_provider in ('supabase','r2','b2'));
  end if;
end $$;

-- 既存の写真・書類はすべて Supabase 保管なので、明示的に埋めておく
update public.project_files
   set storage_provider = 'supabase'
 where storage_provider is null;

comment on column public.project_files.storage_provider
  is 'ファイル実体の保存先。supabase / r2 / b2。読み出しはこの値で署名URLを出し分ける';


-- 確認
select storage_provider, count(*) as 件数
from public.project_files
group by storage_provider
order by storage_provider;
