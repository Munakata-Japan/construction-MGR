-- ============================================================
-- 宗像総合管理システム  現場ハブ（現場別にすべてを集約）用の件数集計
-- BUILD: phase11_genba_hub v20260904A
-- ------------------------------------------------------------
-- 目的：現場（工事）ごとに 日報・写真・書類 の件数を一覧で「すぐ見て判断」
-- できるようにする。件数はサーバー側で GROUP BY してまとめて返すので、
-- 工事や写真が増えても軽く、1000件の取得上限にも引っかからない。
--   reports_total   … 日報の総数
--   reports_pending … 確認待ち（submitted）の日報数（現場側からの提出直後）
--   photos          … 写真の枚数
--   docs            … 書類・図面などの件数
--   last_report     … 最新の日報の日付
--   last_file       … 最後に写真・書類が入った日時
-- 呼び出した本人の会社（organization）の工事だけを返す。
-- ------------------------------------------------------------
-- 前提: projects / daily_reports / project_files / app_users まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

create or replace function public.project_folder_counts()
returns table (
  project_id      uuid,
  reports_total   integer,
  reports_pending integer,
  photos          integer,
  docs            integer,
  last_report     date,
  last_file       timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(r.total, 0)::int,
    coalesce(r.pending, 0)::int,
    coalesce(f.photos, 0)::int,
    coalesce(f.docs, 0)::int,
    r.last_report,
    f.last_file
  from public.projects p
  left join (
    select project_id,
           count(*)                                   as total,
           count(*) filter (where status = 'submitted') as pending,
           max(report_date)                           as last_report
    from public.daily_reports
    where is_active
    group by project_id
  ) r on r.project_id = p.id
  left join (
    select project_id,
           count(*) filter (where file_kind = 'photo')                          as photos,
           count(*) filter (where file_kind in ('document','drawing','other'))  as docs,
           max(created_at)                                                      as last_file
    from public.project_files
    where is_active
    group by project_id
  ) f on f.project_id = p.id
  where p.is_active
    and coalesce(p.is_sample, false) = false
    and p.organization_id = (
      select organization_id from public.app_users
      where auth_user_id = auth.uid()
    );
$$;

grant execute on function public.project_folder_counts() to authenticated;


-- 確認（自分の会社の工事ごとの件数が出る）
select * from public.project_folder_counts();
