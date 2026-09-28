-- ============================================================
-- 建設統合管理システム  招待リンクによるログイン発行
-- BUILD: phase4_invite v20260903A
-- ------------------------------------------------------------
-- これまでは、管理者が Supabase の Authentication → Users で
-- アカウントを手動作成し、そのUIDを利用者ページに貼り付ける
-- という完全手作業の仕組みだった。
--
-- これを、管理者は「招待リンクを発行する」だけで済むようにし、
-- 本人がそのリンクを開いて自分でメール・パスワードを設定すると、
-- 自動的に自分の社員レコード（app_users）と紐づく仕組みにする。
-- ------------------------------------------------------------
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

alter table public.app_users
  add column if not exists invite_token uuid,
  add column if not exists invite_expires_at timestamptz;

comment on column public.app_users.invite_token
  is '招待リンク用の使い捨てトークン。ログインが紐づいたらnullに戻す';
comment on column public.app_users.invite_expires_at
  is '招待リンクの有効期限。過ぎたら claim_invite() は失敗する';

-- 同時に有効なトークンが重複しないように
create unique index if not exists app_users_invite_token_key
  on public.app_users (invite_token) where invite_token is not null;

-- ------------------------------------------------------------
-- 招待リンクを開いた人に、最小限の情報だけを安全に見せる
-- （app_users を直接 select させると個人情報が広く見えてしまうため、
--   関数経由で氏名と会社名、有効かどうかだけを返す）
-- ------------------------------------------------------------
create or replace function public.get_invite(p_token uuid)
returns table(name text, organization_name text, valid boolean)
language sql security definer set search_path = public
as $$
  select u.name, o.name,
    (u.auth_user_id is null and (u.invite_expires_at is null or u.invite_expires_at > now()))
  from public.app_users u
  join public.organizations o on o.id = u.organization_id
  where u.invite_token = p_token
  limit 1;
$$;
grant execute on function public.get_invite(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- サインアップ直後、本人のセッションで呼び出し、
-- そのトークンに対応する社員レコードへ auth_user_id を紐づける。
-- auth.uid() は「今まさにログインしている本人」なので、
-- 他人になりすまして紐づけることはできない。
-- ------------------------------------------------------------
create or replace function public.claim_invite(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.app_users
  set auth_user_id = auth.uid(), invite_token = null, invite_expires_at = null
  where invite_token = p_token
    and auth_user_id is null
    and (invite_expires_at is null or invite_expires_at > now())
  returning id into v_id;
  return v_id is not null;
end;
$$;
grant execute on function public.claim_invite(uuid) to authenticated;


-- ------------------------------------------------------------
-- 確認：関数が作られたか
-- ------------------------------------------------------------
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public' and routine_name in ('get_invite', 'claim_invite');
