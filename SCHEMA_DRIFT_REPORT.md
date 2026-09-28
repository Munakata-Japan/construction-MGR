# スキーマ・ドリフト分析レポート (construction-MGR)

静的HTML+Supabase(PostgREST) アプリで、コードが使う列がDBに無いと
`Could not find the 'X' column of 'TABLE' in the schema cache` で操作全体が失敗する。
本レポートは、全 *.html と common.js が実際に読み書きする列と、全 *.sql で定義済みの列を突き合わせ、
**SQLに定義が見当たらずコードが使う列**（＝本番DBで欠けうる列）をテーブルごとに列挙したもの。
対応する冪等・非破壊の DDL は `schema_ensure.sql`（`add column if not exists` のみ）に集約した。

## 重要: 今回の total_amount と同類（SQL未定義でコードが書き込む列）

`phase_orders.total_amount` は `phase2_order_items.sql` に定義があるが、本番DBで未適用だと保存が丸ごと失敗した。
同じ構造（コードが insert/update するのにDB側で欠けうる列）は多数存在する。特に **ベーステーブル定義がリポジトリ外**
のテーブル（phase_orders, projects, partners, app_users, project_phases, daily_reports など）は、列追加SQLが
リポジトリに無いため、本番DBの列構成がコードと乖離しても検知できない。schema_ensure.sql がその保険となる。

## 抽出の根拠（変数組み立て body を含む主な書き込み箇所）

- `schedule.html` saveOrder: `body`→`sb.from('phase_orders').insert/update(b)`（total_amount, due_note, lead_days, ordered_on ほか）
- `budget.html:640-648`: `body`→`phase_budget_items`（contract_amount, order_date, delivered_qty, quality_status/note ほか）
- `projects.html:793-823`: `body`→`projects`（client_contact, client_tel, site_lot, site_area, permits(jsonb) ほか）
- `partners.html:432-464`: `body`→`partners`（si_health/pension/employment, invoice_reg_no, corporate_number ほか）
- `reports.html:428-450`: `body`→`daily_reports`（weather, worker_count, cost_up_note ほか）＋`daily_report_lines`
- `users.html:617-644`: `body`→`app_users`（approve_limit, employee_type, supervisor_user_id ほか）
- `schedule.html:2416-2442`: `body`→`project_phases`（order_partner_id, order_alert_days, ordered_at ほか）＋`phase_dependencies`
- `files.html`/`handover.html`/`common.js`: `project_files`（doc_category, doc_subcategory, geo_*, bb_extra ほか）

## テーブル別ドリフト一覧

### phase_orders
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (18)**: alert_days, assignee_user_id, budget_item_id, delivered_on, due_date, due_note, is_active, lead_days, note, ordered_on, organization_id, partner_id, phase_id, project_id, scope, seq, status, title

### phase_order_items
- ベーステーブル定義: リポジトリ内 SQL あり
- SQL未定義列: なし

### phase_budget_items
- ベーステーブル定義: リポジトリ内 SQL あり
- **SQLに定義が無くコードが使う列 (2)**: is_import, procurement_type

### project_files
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (26)**: bb_extra, byte_size, captured_at, created_at, description, file_kind, geo_accuracy_m, geo_source, height_px, is_active, lat, lng, mime_type, organization_id, original_name, phase_id, project_id, purpose, sort_order, storage_path, tags, taken_on, thumb_path, title, uploaded_by, width_px
- 要確認（動的列）: blackboard 動的列 body[el.dataset.col]（列名は blackboard_fields.col_key 依存で不定）

### projects
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (24)**: agent_name, client_contact, client_partner_id, client_tel, construction_type, contract_amount, contract_date, end_date_actual, end_date_planned, engineer_name, insurance_note, is_active, manager_user_id, name, note, organization_id, permits, project_no, site_address, site_area, site_lot, start_date, status, tax_rate

### partners
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (26)**: address, corporate_number, email, fax, invoice_reg_no, is_active, is_client, is_subcontractor, is_supplier, license_end_on, license_kinds, license_no, license_start_on, name, name_kana, note, organization_id, partner_type, postal_code, rep_name, si_checked_on, si_employment, si_health, si_pension, tel, trade_start_on

### partner_contacts
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (9)**: email, is_active, is_primary, name, organization_id, partner_id, sort_order, tel, title

### daily_reports
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (18)**: cost_down_note, cost_up_note, is_active, machines, materials, note, organization_id, partner_company, partner_name, project_id, report_date, reporter_type, reporter_user_id, status, submitted_at, tomorrow_plan, weather, worker_count

### daily_report_lines
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (8)**: daily_report_id, mandays, organization_id, phase_id, phase_name, progress_note, seq, unfinished_note

### project_phases
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (18)**: cost_category_id, end_date, is_active, name, note, order_alert_days, order_alert_user_id, order_content, order_deadline, order_partner_id, ordered_at, organization_id, planned_mandays, project_id, seq, start_date, status, work_type_id

### phase_dependencies
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (6)**: dep_type, from_phase_id, lag_days, organization_id, project_id, to_phase_id

### app_users
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (18)**: approve_limit, approve_unlimited, department, email, employee_no, employee_type, hired_on, is_active, is_external, job_rank_id, name, note, organization_id, partner_id, role, supervisor_user_id, tel, title

### app_user_rates
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (4)**: amount, app_user_id, organization_id, rate_type

### report_links
- ベーステーブル定義: リポジトリ外（本番DBに既存前提）
- **SQLに定義が無くコードが使う列 (6)**: created_at, created_by, is_active, label, organization_id, project_id

### schedule_revisions
- ベーステーブル定義: リポジトリ内 SQL あり
- SQL未定義列: なし

## 読み取り専用の参照テーブル（DDLには含めず・要確認）

以下は insert/update が無い（select/eq/order のみ）ため、欠損しても保存を壊す可能性は低く、
型・存在の確信も持てないため schema_ensure.sql には含めていない。列が実際に欠けている場合は個別に確認。

- **organizations** (読み取り専用 / 列指定select): 参照列 = id, name
- **blackboard_fields** (読み取り専用 / select(*)含む): 参照列 = is_active, sort_order
- **cost_categories** (読み取り専用 / 列指定select): 参照列 = code, cost_group, id, is_active, name, sort_order
- **job_ranks** (読み取り専用 / select(*)含む): 参照列 = id, is_active, rank_order
- **permit_kinds** (読み取り専用 / 列指定select): 参照列 = id, is_active, name, sort_order
- **work_types** (読み取り専用 / 列指定select): 参照列 = cost_category_id, hint, id, is_active, name, sort_order

## サマリ

- schema_ensure.sql に含めた列数: **235 列** / **15 テーブル**
- すべて `alter table ... add column if not exists`（非破壊・冪等）。drop/not null/型変更/FK/RLS は不使用。
- ベーステーブル定義がリポジトリ内にあるのは phase_order_items, phase_budget_items, schedule_revisions のみ。
  他の12テーブルは本番DBに既存前提（＝リポジトリだけでは列ドリフトを検知不能なので本ファイルが保険）。
