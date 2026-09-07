-- ============================================================
--  phase21_partner_contact_user.sql  取引先の担当者→ログイン招待
--  ------------------------------------------------------------
--  取引先(協力会社)の担当者(partner_contacts)から、再入力なしで
--  システムログインへ招待できるようにする。担当者に、作成した
--  ログインアカウント(app_users)へのリンク列を持たせる。
--  非破壊・冪等。Supabase の SQL Editor で1回実行してください。
--  ※ app_users.partner_id / invite_token / claim_invite() は既存
--    （phase4_invite.sql・基礎スキーマ）を利用します。
-- ============================================================

alter table public.partner_contacts add column if not exists app_user_id uuid;

notify pgrst, 'reload schema';
