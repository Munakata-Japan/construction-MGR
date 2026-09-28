-- ============================================================
--  phase20_progress.sql  出来高・進捗（%）RE4
--  ------------------------------------------------------------
--  各工程に進捗率(0〜100%)を持たせ、出来高＝Σ(工程の予算×%) を出す土台。
--  非破壊・冪等。Supabase の SQL Editor で1回実行してください。
-- ============================================================

alter table public.project_phases add column if not exists progress_pct integer;

notify pgrst, 'reload schema';
