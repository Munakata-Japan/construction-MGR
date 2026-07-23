# construction-MGR

宗像総合開発株式会社　建設統合管理システム

現場管理・工事台帳・勤怠管理をひとつにまとめる仕組みです。

- 公開先: https://munakata-japan.github.io/construction-MGR/
- データ: Supabase（プロジェクト `construction-MGR`）

---

## 現在の段階

**フェーズ0（土台）** — 会社・利用者・取引先・費目・工事の登録まで。

| 段階 | 内容 | 状況 |
|---|---|---|
| 準備 | 土台（会社・利用者・権限・工事） | 進行中 |
| 第一段階 | 現場管理（工程表・日報・写真） | 未着手 |
| 第二段階 | 工事台帳（予算・発注・支払・請求） | 未着手 |
| 第三段階 | 勤怠管理（打刻・人件費の反映） | 未着手 |

第三段階に入る前に、就業規則の整備が必要です。位置情報を用いた出退勤管理は、
規定・意見聴取・届出・周知・同意の手続きを終えてから稼働させます。

---

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | ログイン画面 |
| `projects.html` | 工事の一覧・登録・編集 |
| `common.css` | 全画面共通の見た目 |
| `common.js` | ログイン確認と共通処理 |
| `config.js` | Supabase への接続先 |
| `phase0_foundation.sql` | データベースの定義（Supabase の SQL Editor で実行） |

`config.js` に書かれているキーは公開して使う前提のものです。
データの保護は Supabase 側で行っており、ログインしなければ中身は取得できません。

---

## 見られる範囲

| 操作 | 経営者 | 現場監督 | 作業員 |
|---|---|---|---|
| 工事の閲覧 | ○ | ○ | ○ |
| 工事の登録・編集 | ○ | ○ | × |
| 工事の削除 | ○ | × | × |
| 日給・単価の閲覧 | 全員分 | 自分の分のみ | 自分の分のみ |

---

## 画面を公開する設定

リポジトリの Settings → Pages → Source を `Deploy from a branch`、
Branch を `main` / `/ (root)` にして Save。数分後に公開されます。

---

## 利用者を増やすとき

1. Supabase の Authentication → Users → Add user でログイン用アカウントを作る
2. SQL Editor で次を実行する（UID は作成したユーザーの UID）

```sql
insert into public.app_users (organization_id, auth_user_id, name, role, employee_type)
values (
  '472d738a-5ef4-4ce6-b160-bd283db4112f',
  'ここに UID',
  'ここに氏名',
  'member',      -- admin / manager / member
  'craftsman'    -- employee / craftsman / subcontractor
);
```
