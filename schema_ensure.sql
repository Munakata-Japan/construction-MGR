-- schema_ensure.sql
-- 目的: construction-MGR のスキーマ・ドリフト（コードが使う列がDBに無い状態）を根絶するための
--       冪等・非破壊の「列の存在保証」スクリプト。
--       各列は `add column if not exists` のみ。drop / not null 追加 / 型変更 / FK・RLS 再定義は一切しない。
--       PostgREST の "Could not find the 'X' column of 'TABLE' in the schema cache" を防ぐことが狙い。
--
-- 使い方: Supabase SQL Editor でそのまま実行。何度実行しても安全（冪等）。
--         末尾で PostgREST にスキーマ再読込を通知する。
--
-- 生成方法: 全 *.html と common.js の sb.from(...).insert/update/upsert のキー、および
--           select/eq/order 等で参照される列を抽出し、全 *.sql の create/alter で定義済みの列を差し引いて集約。
--
-- 対象: アプリが insert/update する 15 テーブルの全書き込み列＋参照列。
--       読み取り専用の参照テーブル（organizations, cost_categories, job_ranks, permit_kinds,
--       blackboard_fields, work_types）と、列名が動的に決まる blackboard 拡張列は、
--       型・存在の確信が持てないため本ファイルには含めず、SCHEMA_DRIFT_REPORT.md に「要確認」として記載。
--
-- 型は既存SQLに定義があればそれを踏襲、無ければ使われ方から推定（*_id/*_by=uuid, *_date/*_on=date,
--       is_*=boolean, 金額/数量=numeric, 個数/日数/連番=integer, tags/license_kinds=text[], permits/bb_extra=jsonb）。
--
-- 注意: base テーブルの多くはリポジトリ外（本番DB）で作成済み前提のため create table は行わず、
--       既存テーブルへの列追加に徹する。テーブル自体が存在しない環境では該当 alter がエラーになるが、
--       それは「そのテーブルが未作成」というアプリ実行不能状態であり、本ファイルの守備範囲外。


begin;

-- phase_orders
alter table public.phase_orders add column if not exists alert_days integer;
alter table public.phase_orders add column if not exists assignee_user_id uuid;
alter table public.phase_orders add column if not exists budget_item_id uuid;
alter table public.phase_orders add column if not exists delivered_on date;
alter table public.phase_orders add column if not exists due_date date;
alter table public.phase_orders add column if not exists due_note text;
alter table public.phase_orders add column if not exists is_active boolean;
alter table public.phase_orders add column if not exists lead_days integer;
alter table public.phase_orders add column if not exists note text;
alter table public.phase_orders add column if not exists ordered_on date;
alter table public.phase_orders add column if not exists organization_id uuid;
alter table public.phase_orders add column if not exists partner_id uuid;
alter table public.phase_orders add column if not exists phase_id uuid;
alter table public.phase_orders add column if not exists project_id uuid;
alter table public.phase_orders add column if not exists scope text;
alter table public.phase_orders add column if not exists seq integer;
alter table public.phase_orders add column if not exists status text;
alter table public.phase_orders add column if not exists title text;
alter table public.phase_orders add column if not exists total_amount numeric;

-- phase_order_items
alter table public.phase_order_items add column if not exists item_name text;
alter table public.phase_order_items add column if not exists note text;
alter table public.phase_order_items add column if not exists organization_id uuid;
alter table public.phase_order_items add column if not exists phase_order_id uuid;
alter table public.phase_order_items add column if not exists quantity numeric;
alter table public.phase_order_items add column if not exists seq integer;
alter table public.phase_order_items add column if not exists unit text;
alter table public.phase_order_items add column if not exists unit_price numeric;

-- phase_budget_items
alter table public.phase_budget_items add column if not exists amount numeric;
alter table public.phase_budget_items add column if not exists budget_amount numeric;
alter table public.phase_budget_items add column if not exists category text;
alter table public.phase_budget_items add column if not exists contract_amount numeric;
alter table public.phase_budget_items add column if not exists cost_stage text;
alter table public.phase_budget_items add column if not exists created_by uuid;
alter table public.phase_budget_items add column if not exists delivered_on date;
alter table public.phase_budget_items add column if not exists delivered_qty numeric;
alter table public.phase_budget_items add column if not exists discipline text;
alter table public.phase_budget_items add column if not exists due_date date;
alter table public.phase_budget_items add column if not exists estimate_partner_id uuid;
alter table public.phase_budget_items add column if not exists is_import boolean;
alter table public.phase_budget_items add column if not exists item_name text;
alter table public.phase_budget_items add column if not exists lead_time_days integer;
alter table public.phase_budget_items add column if not exists note text;
alter table public.phase_budget_items add column if not exists order_date date;
alter table public.phase_budget_items add column if not exists organization_id uuid;
alter table public.phase_budget_items add column if not exists phase_id uuid;
alter table public.phase_budget_items add column if not exists procurement_type text;
alter table public.phase_budget_items add column if not exists project_id uuid;
alter table public.phase_budget_items add column if not exists quality_note text;
alter table public.phase_budget_items add column if not exists quality_status text;
alter table public.phase_budget_items add column if not exists quantity numeric;
alter table public.phase_budget_items add column if not exists scheduled_delivery_date date;
alter table public.phase_budget_items add column if not exists seq integer;
alter table public.phase_budget_items add column if not exists sort_order integer;
alter table public.phase_budget_items add column if not exists status text;
alter table public.phase_budget_items add column if not exists unit text;
alter table public.phase_budget_items add column if not exists unit_price numeric;

-- project_files
alter table public.project_files add column if not exists assignee_name text;
alter table public.project_files add column if not exists bb_extra jsonb;
alter table public.project_files add column if not exists byte_size bigint;
alter table public.project_files add column if not exists captured_at timestamptz;
alter table public.project_files add column if not exists created_at timestamptz;
alter table public.project_files add column if not exists daily_report_id uuid;
alter table public.project_files add column if not exists description text;
alter table public.project_files add column if not exists doc_category text;
alter table public.project_files add column if not exists doc_subcategory text;
alter table public.project_files add column if not exists file_kind text;
alter table public.project_files add column if not exists geo_accuracy_m numeric;
alter table public.project_files add column if not exists geo_source text;
alter table public.project_files add column if not exists height_px integer;
alter table public.project_files add column if not exists is_active boolean;
alter table public.project_files add column if not exists lat numeric;
alter table public.project_files add column if not exists lng numeric;
alter table public.project_files add column if not exists mime_type text;
alter table public.project_files add column if not exists organization_id uuid;
alter table public.project_files add column if not exists original_name text;
alter table public.project_files add column if not exists phase_id uuid;
alter table public.project_files add column if not exists project_id uuid;
alter table public.project_files add column if not exists purpose text;
alter table public.project_files add column if not exists sort_order integer;
alter table public.project_files add column if not exists storage_path text;
alter table public.project_files add column if not exists tags text[];
alter table public.project_files add column if not exists taken_on date;
alter table public.project_files add column if not exists thumb_path text;
alter table public.project_files add column if not exists title text;
alter table public.project_files add column if not exists uploaded_by uuid;
alter table public.project_files add column if not exists width_px integer;

-- projects
alter table public.projects add column if not exists agent_name text;
alter table public.projects add column if not exists client_contact text;
alter table public.projects add column if not exists client_partner_id uuid;
alter table public.projects add column if not exists client_tel text;
alter table public.projects add column if not exists construction_type text;
alter table public.projects add column if not exists contract_amount numeric;
alter table public.projects add column if not exists contract_date date;
alter table public.projects add column if not exists end_date_actual date;
alter table public.projects add column if not exists end_date_planned date;
alter table public.projects add column if not exists engineer_name text;
alter table public.projects add column if not exists insurance_note text;
alter table public.projects add column if not exists is_active boolean;
alter table public.projects add column if not exists is_sample boolean;
alter table public.projects add column if not exists manager_name text;
alter table public.projects add column if not exists manager_user_id uuid;
alter table public.projects add column if not exists name text;
alter table public.projects add column if not exists note text;
alter table public.projects add column if not exists organization_id uuid;
alter table public.projects add column if not exists permits jsonb;
alter table public.projects add column if not exists project_no text;
alter table public.projects add column if not exists schedule_revised_by uuid;
alter table public.projects add column if not exists schedule_revised_on date;
alter table public.projects add column if not exists schedule_version integer;
alter table public.projects add column if not exists site_address text;
alter table public.projects add column if not exists site_area numeric;
alter table public.projects add column if not exists site_lot text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists status text;
alter table public.projects add column if not exists tax_rate numeric;

-- partners
alter table public.partners add column if not exists address text;
alter table public.partners add column if not exists corporate_number text;
alter table public.partners add column if not exists email text;
alter table public.partners add column if not exists fax text;
alter table public.partners add column if not exists invoice_reg_no text;
alter table public.partners add column if not exists is_active boolean;
alter table public.partners add column if not exists is_client boolean;
alter table public.partners add column if not exists is_subcontractor boolean;
alter table public.partners add column if not exists is_supplier boolean;
alter table public.partners add column if not exists license_end_on date;
alter table public.partners add column if not exists license_kinds text[];
alter table public.partners add column if not exists license_no text;
alter table public.partners add column if not exists license_start_on date;
alter table public.partners add column if not exists name text;
alter table public.partners add column if not exists name_kana text;
alter table public.partners add column if not exists note text;
alter table public.partners add column if not exists organization_id uuid;
alter table public.partners add column if not exists partner_type text;
alter table public.partners add column if not exists postal_code text;
alter table public.partners add column if not exists rep_name text;
alter table public.partners add column if not exists si_checked_on date;
alter table public.partners add column if not exists si_employment boolean;
alter table public.partners add column if not exists si_health boolean;
alter table public.partners add column if not exists si_pension boolean;
alter table public.partners add column if not exists tel text;
alter table public.partners add column if not exists trade_start_on date;

-- partner_contacts
alter table public.partner_contacts add column if not exists email text;
alter table public.partner_contacts add column if not exists is_active boolean;
alter table public.partner_contacts add column if not exists is_primary boolean;
alter table public.partner_contacts add column if not exists name text;
alter table public.partner_contacts add column if not exists organization_id uuid;
alter table public.partner_contacts add column if not exists partner_id uuid;
alter table public.partner_contacts add column if not exists sort_order integer;
alter table public.partner_contacts add column if not exists tel text;
alter table public.partner_contacts add column if not exists title text;

-- daily_reports
alter table public.daily_reports add column if not exists cost_down_note text;
alter table public.daily_reports add column if not exists cost_up_note text;
alter table public.daily_reports add column if not exists is_active boolean;
alter table public.daily_reports add column if not exists machines text;
alter table public.daily_reports add column if not exists materials text;
alter table public.daily_reports add column if not exists note text;
alter table public.daily_reports add column if not exists organization_id uuid;
alter table public.daily_reports add column if not exists partner_company text;
alter table public.daily_reports add column if not exists partner_name text;
alter table public.daily_reports add column if not exists project_id uuid;
alter table public.daily_reports add column if not exists report_date date;
alter table public.daily_reports add column if not exists reporter_type text;
alter table public.daily_reports add column if not exists reporter_user_id uuid;
alter table public.daily_reports add column if not exists status text;
alter table public.daily_reports add column if not exists submitted_at timestamptz;
alter table public.daily_reports add column if not exists tomorrow_plan text;
alter table public.daily_reports add column if not exists weather text;
alter table public.daily_reports add column if not exists worker_count integer;

-- daily_report_lines
alter table public.daily_report_lines add column if not exists daily_report_id uuid;
alter table public.daily_report_lines add column if not exists mandays numeric;
alter table public.daily_report_lines add column if not exists organization_id uuid;
alter table public.daily_report_lines add column if not exists phase_id uuid;
alter table public.daily_report_lines add column if not exists phase_name text;
alter table public.daily_report_lines add column if not exists progress_note text;
alter table public.daily_report_lines add column if not exists seq integer;
alter table public.daily_report_lines add column if not exists unfinished_note text;

-- project_phases
alter table public.project_phases add column if not exists cost_category_id uuid;
alter table public.project_phases add column if not exists end_date date;
alter table public.project_phases add column if not exists is_active boolean;
alter table public.project_phases add column if not exists name text;
alter table public.project_phases add column if not exists note text;
alter table public.project_phases add column if not exists order_alert_days integer;
alter table public.project_phases add column if not exists order_alert_user_id uuid;
alter table public.project_phases add column if not exists order_content text;
alter table public.project_phases add column if not exists order_deadline date;
alter table public.project_phases add column if not exists order_partner_id uuid;
alter table public.project_phases add column if not exists ordered_at timestamptz;
alter table public.project_phases add column if not exists organization_id uuid;
alter table public.project_phases add column if not exists planned_mandays numeric;
alter table public.project_phases add column if not exists project_id uuid;
alter table public.project_phases add column if not exists seq integer;
alter table public.project_phases add column if not exists start_date date;
alter table public.project_phases add column if not exists status text;
alter table public.project_phases add column if not exists work_type_id uuid;

-- phase_dependencies
alter table public.phase_dependencies add column if not exists dep_type text;
alter table public.phase_dependencies add column if not exists from_phase_id uuid;
alter table public.phase_dependencies add column if not exists lag_days integer;
alter table public.phase_dependencies add column if not exists organization_id uuid;
alter table public.phase_dependencies add column if not exists project_id uuid;
alter table public.phase_dependencies add column if not exists to_phase_id uuid;

-- app_users
alter table public.app_users add column if not exists approve_limit numeric;
alter table public.app_users add column if not exists approve_unlimited boolean;
alter table public.app_users add column if not exists department text;
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists employee_no text;
alter table public.app_users add column if not exists employee_type text;
alter table public.app_users add column if not exists hired_on date;
alter table public.app_users add column if not exists is_active boolean;
alter table public.app_users add column if not exists is_developer boolean;
alter table public.app_users add column if not exists is_external boolean;
alter table public.app_users add column if not exists job_rank_id uuid;
alter table public.app_users add column if not exists name text;
alter table public.app_users add column if not exists note text;
alter table public.app_users add column if not exists organization_id uuid;
alter table public.app_users add column if not exists partner_id uuid;
alter table public.app_users add column if not exists role text;
alter table public.app_users add column if not exists supervisor_user_id uuid;
alter table public.app_users add column if not exists tel text;
alter table public.app_users add column if not exists title text;

-- app_user_rates
alter table public.app_user_rates add column if not exists amount numeric;
alter table public.app_user_rates add column if not exists app_user_id uuid;
alter table public.app_user_rates add column if not exists organization_id uuid;
alter table public.app_user_rates add column if not exists rate_type text;

-- report_links
alter table public.report_links add column if not exists created_at timestamptz;
alter table public.report_links add column if not exists created_by uuid;
alter table public.report_links add column if not exists is_active boolean;
alter table public.report_links add column if not exists label text;
alter table public.report_links add column if not exists organization_id uuid;
alter table public.report_links add column if not exists project_id uuid;

-- schedule_revisions
alter table public.schedule_revisions add column if not exists note text;
alter table public.schedule_revisions add column if not exists phase_count integer;
alter table public.schedule_revisions add column if not exists project_id uuid;
alter table public.schedule_revisions add column if not exists revised_by uuid;
alter table public.schedule_revisions add column if not exists revised_on date;
alter table public.schedule_revisions add column if not exists version integer;

commit;

-- PostgREST にスキーマ再読込を通知（列追加を即時反映）
notify pgrst, 'reload schema';
