-- 組織情報（会社レベルの建設業許可・事業内容・取引銀行）
-- 工事（projects）ごとの許認可欄とは別に、会社に1つだけ持つ情報。
-- Supabase の SQL Editor で実行してください。

alter table public.organizations
  add column if not exists license_no       text,   -- 許可番号（例: 福岡県知事許可（特-28）第110125号）
  add column if not exists license_issuer   text,   -- 許可行政庁（例: 福岡県知事）
  add column if not exists license_types    text,   -- 許可業種（例: 電気工事業、土木工事業、とび土木工事業…）
  add column if not exists business_content text,   -- 事業内容
  add column if not exists bank_info        text;   -- 取引銀行
