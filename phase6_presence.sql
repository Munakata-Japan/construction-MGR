-- ============================================================
-- 宗像総合管理システム  ログイン中の人数（在席表示）
-- BUILD: phase6_presence v20260904A
-- ------------------------------------------------------------
-- 「いま何人がシステムを使っているか」を見えるようにするための
-- 最小限の仕組み。各ページを開いている間、一定間隔で本人の
-- 最終アクセス時刻（last_seen_at）を記録し、直近数分以内に
-- 動きがある人を「ログイン中」として数える。
--   ・時計（就業時間）で切り替わるのではなく、実際の利用で増減する
--   ・人数だけを返す（誰が、までは返さない）
-- ------------------------------------------------------------
-- 前提: app_users, current_org_id() まで作成済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. 最終アクセス時刻の列
-- ------------------------------------------------------------
alter table public.app_users
  add column if not exists last_seen_at timestamptz;

comment on column public.app_users.last_seen_at
  is 'システムを最後に操作していた時刻。ログイン中の人数の判定に使う';


-- ------------------------------------------------------------
-- 2. 本人の最終アクセス時刻を打刻する（各ページから定期的に呼ぶ）
--    app_users の書き込みは通常 経営者・監督のみだが、これは
--    「本人が自分の行を更新するだけ」なので SECURITY DEFINER で許可する。
-- ------------------------------------------------------------
create or replace function public.touch_presence()
returns void
language sql security definer set search_path = public
as $$
  update public.app_users
     set last_seen_at = now()
   where auth_user_id = auth.uid();
$$;

grant execute on function public.touch_presence() to authenticated;


-- ------------------------------------------------------------
-- 3. いまログイン中の人数を返す（自社ぶんだけ・人数のみ）
--    p_minutes 分以内に動きがある、有効な利用者を数える。
-- ------------------------------------------------------------
create or replace function public.online_count(p_minutes integer default 5)
returns integer
language sql security definer set search_path = public
as $$
  select count(*)::int
  from public.app_users
  where organization_id = public.current_org_id()
    and is_active = true
    and last_seen_at is not null
    and last_seen_at > now() - make_interval(mins => greatest(1, p_minutes));
$$;

grant execute on function public.online_count(integer) to authenticated;


-- ------------------------------------------------------------
-- 4. 確認
-- ------------------------------------------------------------
select proname
from pg_proc
where proname in ('touch_presence', 'online_count')
order by proname;
