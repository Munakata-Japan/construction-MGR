-- ============================================================
-- 建設統合管理システム  工程表の版数管理
-- BUILD: phase1a_revision v20260723A
-- ------------------------------------------------------------
-- 工程表は何度も作り直すもの。
-- 「いつ作った第何版か」を残し、変更の履歴を辿れるようにする。
-- ------------------------------------------------------------
-- 前提: phase1a_sample_hint.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================


-- ------------------------------------------------------------
-- 1. 工事に版数を持たせる
-- ------------------------------------------------------------
alter table public.projects add column if not exists schedule_version    integer not null default 1;
alter table public.projects add column if not exists schedule_revised_on date;
alter table public.projects add column if not exists schedule_revised_by uuid references public.app_users(id) on delete set null;

comment on column public.projects.schedule_version    is '工程表の版数。1から始まり、改訂のたびに1つ上がる';
comment on column public.projects.schedule_revised_on is '工程表を作成・改訂した日';
comment on column public.projects.schedule_revised_by is '工程表を作成・改訂した人';


-- ------------------------------------------------------------
-- 2. 改訂の履歴
-- ------------------------------------------------------------
create table if not exists public.schedule_revisions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  version         integer not null,
  revised_on      date not null default current_date,
  revised_by      uuid references public.app_users(id) on delete set null,
  note            text,
  phase_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists idx_srev_project
  on public.schedule_revisions(project_id, version desc);

comment on table  public.schedule_revisions is '工程表の改訂履歴。何をなぜ変えたかを残す';
comment on column public.schedule_revisions.note is '改訂の理由。「降雨により造成を2週間延伸」など';


-- ------------------------------------------------------------
-- 3. 権限と RLS
-- ------------------------------------------------------------
grant select, insert, update, delete on public.schedule_revisions to authenticated;

alter table public.schedule_revisions enable row level security;

drop policy if exists srev_select on public.schedule_revisions;
create policy srev_select on public.schedule_revisions
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists srev_write on public.schedule_revisions;
create policy srev_write on public.schedule_revisions
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());


-- ------------------------------------------------------------
-- 4. 版を上げる
--    工程表を直したときに呼ぶ。版数を1つ上げ、履歴に1行残す。
-- ------------------------------------------------------------
create or replace function public.bump_schedule_version(
  p_project_id uuid,
  p_note       text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_org  uuid;
  v_me   uuid;
  v_ver  integer;
  v_cnt  integer;
begin
  v_org := public.current_org_id();
  v_me  := public.current_app_user_id();

  if v_org is null then
    raise exception 'ログインしていません';
  end if;
  if not public.is_manager_or_admin() then
    raise exception '版を上げる権限がありません';
  end if;

  select schedule_version into v_ver
  from public.projects
  where id = p_project_id and organization_id = v_org;

  if v_ver is null then
    raise exception 'その工事が見つかりません';
  end if;

  v_ver := v_ver + 1;

  select count(*) into v_cnt
  from public.project_phases
  where project_id = p_project_id and is_active;

  update public.projects
     set schedule_version    = v_ver,
         schedule_revised_on = current_date,
         schedule_revised_by = v_me
   where id = p_project_id;

  insert into public.schedule_revisions
    (organization_id, project_id, version, revised_on, revised_by, note, phase_count)
  values
    (v_org, p_project_id, v_ver, current_date, v_me, p_note, v_cnt);

  return v_ver;
end;
$func$;

grant execute on function public.bump_schedule_version(uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 5. 既にある工事に第1版の記録を入れる
-- ------------------------------------------------------------
do $do$
declare
  v_org uuid := '472d738a-5ef4-4ce6-b160-bd283db4112f';
  r record;
  v_n integer := 0;
begin
  -- 作成日が空の工事に今日を入れる
  update public.projects
     set schedule_revised_on = coalesce(schedule_revised_on, current_date)
   where organization_id = v_org;

  -- 第1版の履歴を作る
  for r in
    select p.id,
           (select count(*) from public.project_phases x
             where x.project_id = p.id and x.is_active) as cnt
    from public.projects p
    where p.organization_id = v_org
  loop
    insert into public.schedule_revisions
      (organization_id, project_id, version, revised_on, note, phase_count)
    values
      (v_org, r.id, 1, current_date, '初版', r.cnt)
    on conflict (project_id, version) do nothing;
    v_n := v_n + 1;
  end loop;

  raise notice '% 件の工事に初版の記録を入れました', v_n;
end;
$do$;


-- ------------------------------------------------------------
-- 6. 確認
-- ------------------------------------------------------------
select p.project_no as 工事番号,
       p.name       as 工事名,
       p.schedule_version    as 版,
       p.schedule_revised_on as 作成日,
       (select count(*) from public.schedule_revisions r where r.project_id = p.id) as 履歴数
from public.projects p
where p.organization_id = '472d738a-5ef4-4ce6-b160-bd283db4112f'
order by p.project_no;
