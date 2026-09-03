-- ============================================================
-- 建設統合管理システム  実行予算：2026-001（2M村山市蓄電所）見積明細の投入
-- BUILD: phase3c_budget_seed_2026-001 v20260903A
-- ------------------------------------------------------------
-- アップロードいただいた見積明細書5枚分（担当：菊地／令和8年8月17日・24日）
-- を phase_budget_items に登録する。
-- 各ページの小計を検算し、以下の合計と一致することを確認済み：
--   ①ケーブル支持金具ほか   小計 56,040
--   ②装柱材①②             小計 350,530
--   ③コン柱                小計 242,000
--   ④接地材                小計 1,365,500
--   ⑤電線ケーブル          小計 10,976,500（税込合計 12,074,160）
-- 見積書の中で網掛け・薄字になっていた行（未採用と見られる代替品）は
-- 含めていません。品名・数量・単価は写真から書き起こしたものなので、
-- 登録後に一覧で必ず見比べてご確認ください。
-- 区分は全て材料費（material）、工程は未設定（工事全体）で登録します。
-- 見積先（メーカー名）は備考欄に記載しています。
-- ------------------------------------------------------------
-- 前提: phase3_budget.sql まで実行済み
-- 実行方法: Supabase の SQL Editor に全文貼付 → Run
-- ============================================================

do $seed$
declare
  v_org  uuid;
  v_proj uuid;
begin
  select organization_id, id into v_org, v_proj
  from public.projects
  where project_no = '2026-001'
  limit 1;

  if v_proj is null then
    raise exception '工事番号 2026-001 が見つかりません。project_no を確認してください。';
  end if;

  insert into public.phase_budget_items
    (organization_id, project_id, category, item_name, quantity, unit, unit_price, note, seq)
  values
    -- ① ケーブル支持金具ほか（小計 56,040）
    (v_org, v_proj, 'material', 'ケーブル支持金具（適用径：Φ55）', 1, '個', 1700, 'メーカー：イワブチ', 10),
    (v_org, v_proj, 'material', 'ケーブル支持金具（適用径：Φ70）', 1, '個', 1750, 'メーカー：イワブチ', 20),
    (v_org, v_proj, 'material', 'イワブチ）取り寄せ送料', 1, '式', 2500, 'メーカー：イワブチ', 30),
    (v_org, v_proj, 'material', 'ラック金物', 2, '個', 600, null, 40),
    (v_org, v_proj, 'material', 'ボルト　13×100ミリ', 2, '本', 380, null, 50),
    (v_org, v_proj, 'material', 'MWH-U新型中線引留', 1, '本', 2500, 'メーカー：イワブチ', 60),
    (v_org, v_proj, 'material', '【支線材】メッセンジャーワイヤ55（7×3.2）20m巻', 1, '巻', 9000, null, 70),
    (v_org, v_proj, 'material', '巻付グリップ55　シンブル用　赤', 5, '本', 780, null, 80),
    (v_org, v_proj, 'material', '巻付グリップ55　玉碍子用　赤', 3, '本', 780, null, 90),
    (v_org, v_proj, 'material', '支線玉碍子（JIS大）100-100', 1, '個', 890, null, 100),
    (v_org, v_proj, 'material', '支線ガード　65パイ　トラ', 1, '本', 3500, 'メーカー：マサル工業', 110),
    (v_org, v_proj, 'material', '地工アンカー　7号（7t）', 1, '組', 26000, null, 120),

    -- ② 装柱材①②（小計 350,530）
    (v_org, v_proj, 'material', '【装柱材①】ステンレスバンド　20mm×50m巻', 3, '巻', 6000, 'メーカー：イワブチ', 130),
    (v_org, v_proj, 'material', '締付金具SLS-2C', 250, '個', 200, 'メーカー：イワブチ', 140),
    (v_org, v_proj, 'material', 'ステンレスバンド用リングサドル', 100, '個', 80, 'メーカー：イワブチ', 150),
    (v_org, v_proj, 'material', 'ケーブル被覆保護カバー20mm×20', 50, '個', 60, 'メーカー：イワブチ', 160),
    (v_org, v_proj, 'material', 'IBT-321自在バンド', 20, '個', 2000, 'メーカー：イワブチ', 170),
    (v_org, v_proj, 'material', 'ゴムロール（天然ゴム）5t×50mm幅L=1物', 10, '巻', 650, '必要な場合', 180),
    (v_org, v_proj, 'material', '【装柱材②】自在バンド（170Φ～265Φ）', 5, '本', 3000, 'メーカー：イワブチ', 190),
    (v_org, v_proj, 'material', '4BD-HD-23自在バンド', 3, '個', 35000, 'メーカー：イワブチ', 200),
    (v_org, v_proj, 'material', 'アームタイレスバンド　標準型', 3, '組', 7200, 'メーカー：イワブチ', 210),
    (v_org, v_proj, 'material', '終端支持腕金　L=1050ミリ', 3, '本', 17000, null, 220),
    (v_org, v_proj, 'material', '取り寄せ送料（ALCT1050）', 1, '式', 2800, null, 230),
    (v_org, v_proj, 'material', 'LGA-1.5-テ軽腕金', 3, '個', 7000, 'メーカー：イワブチ', 240),
    (v_org, v_proj, 'material', 'アームタイ　900ミリ（半円）', 3, '本', 1600, null, 250),
    (v_org, v_proj, 'material', 'ボルト　13×120ミリ（1）', 3, '本', 350, null, 260),
    (v_org, v_proj, 'material', 'TSTPねじりストラップ', 3, '個', 370, null, 270),
    (v_org, v_proj, 'material', 'ボルト　13×120ミリ（2）', 3, '本', 330, null, 280),
    (v_org, v_proj, 'material', '支線シンブル　中（電力型）', 1, '個', 680, null, 290),

    -- ③ コン柱（小計 242,000）／コン柱サイズ：15-19-5.0
    (v_org, v_proj, 'material', 'コンクリートポール　15-19-5.0', 1, '本', 135000, null, 300),
    (v_org, v_proj, 'material', '電力型ネカセ　1.2m　本体', 1, '個', 12000, null, 310),
    (v_org, v_proj, 'material', '電力型ネカセ　1.2m　Uバンド', 1, '本', 5000, null, 320),
    (v_org, v_proj, 'material', '足場ボルト', 20, '本', 500, null, 330),
    (v_org, v_proj, 'material', '運搬費', 1, '式', 80000, null, 340),

    -- ④ 接地材（小計 1,365,500）
    (v_org, v_proj, 'material', '接地銅板900口×1.5t　LH40×1m', 3, '枚', 140000, 'メーカー：村田電機製作所', 350),
    (v_org, v_proj, 'material', 'アース棒　連結式　φ14×1500', 20, '本', 4000, 'メーカー：日動電工', 360),
    (v_org, v_proj, 'material', 'リード端子　φ14用　22sq×300', 10, '個', 1800, 'メーカー：日動電工', 370),
    (v_org, v_proj, 'material', 'エフレックス本体FEP100φ', 400, 'M', 800, 'メーカー：古河電気工業', 380),
    (v_org, v_proj, 'material', 'エフレックスクランプ200φ', 1, '個', 63000, 'メーカー：古河電気工業', 390),
    (v_org, v_proj, 'material', 'エフレックス本体FEP200φ', 50, 'M', 2000, 'メーカー：古河電気工業', 400),
    (v_org, v_proj, 'material', 'エフレックスクランプ100φ', 15, '個', 13500, 'メーカー：古河電気工業', 410),
    (v_org, v_proj, 'material', '直線接続材アクアフィット型100φ', 10, '個', 2700, 'メーカー：古河電気工業', 420),
    (v_org, v_proj, 'material', '埋設シート　高圧電力用　W=150W', 4, '巻', 4000, 'メーカー：日動電工', 430),
    (v_org, v_proj, 'material', '埋設シート　通信用　W=150W', 4, '巻', 4000, 'メーカー：日動電工', 440),
    (v_org, v_proj, 'material', '埋設表示杭　電気', 20, '本', 1500, 'メーカー：北関東工業', 450),
    (v_org, v_proj, 'material', 'プレート', 20, '枚', 350, 'メーカー：北関東工業', 460),
    (v_org, v_proj, 'material', '送料（接地材）', 1, '式', 15000, 'メーカー：北関東工業', 470),
    (v_org, v_proj, 'material', '104　厚鋼電線管　溶融亜鉛メッキ', 1, '本', 19000, 'メーカー：丸一鋼管', 480),
    (v_org, v_proj, 'material', 'エフレックス異種管接続材200φ　FP200-SPG200', 1, '個', 32000, 'メーカー：古河電気工業', 490),

    -- ⑤ 電線ケーブル（小計 10,976,500／税込合計 12,074,160）
    (v_org, v_proj, 'material', '6KVCVT100SQ（EE）', 70, 'M', 14000, 'メーカー：SFCC（株）', 500),
    (v_org, v_proj, 'material', '600VCVT　3C×60', 500, 'M', 5800, null, 510),
    (v_org, v_proj, 'material', '600VCVT　4C×3.5', 150, 'M', 800, null, 520),
    (v_org, v_proj, 'material', '600VCVT　2C×3.5', 150, 'M', 350, null, 530),
    (v_org, v_proj, 'material', '600VCVT　4C×38', 250, 'M', 5000, '納期：10月中旬', 540),
    (v_org, v_proj, 'material', 'DC1500V　PV-CQD　60SQ', 800, 'M', 5500, '納期別途お打合せ', 550),
    (v_org, v_proj, 'material', 'IV　60緑', 150, 'M', 2200, null, 560),
    (v_org, v_proj, 'material', 'IV　38緑', 200, 'M', 1500, null, 570),
    (v_org, v_proj, 'material', 'IV　14緑', 200, 'M', 700, null, 580),
    (v_org, v_proj, 'material', 'IV　5.5緑', 300, 'M', 280, null, 590),
    (v_org, v_proj, 'material', '裸軟銅線　A5.5', 100, 'M', 280, null, 600),
    (v_org, v_proj, 'material', 'カテゴリー0.5×4P（CAT5e）シールド付（200M定尺）', 1200, 'M', 200, null, 610),
    (v_org, v_proj, 'material', 'カテゴリー0.5×4P（CAT5e）シールド付（RS485　200M定尺）', 150, 'M', 180, null, 620),
    (v_org, v_proj, 'material', 'KPEV-SB　0.9×1P', 150, 'M', 300, null, 630),
    (v_org, v_proj, 'material', '端末処理材（プレハブ式）6KVCVT100屋内', 1, '組', 40000, 'メーカー：古河電工パワーシステム', 640),
    (v_org, v_proj, 'material', '端末処理材（プレハブ式）6KVCVT100屋外', 1, '組', 40000, 'メーカー：古河電工パワーシステム', 650);

  raise notice '登録しました（工事 2026-001）';
end;
$seed$;


-- ------------------------------------------------------------
-- 確認：登録件数と合計金額（見積ベース＝単価×数量）
-- ------------------------------------------------------------
select count(*) as 件数, sum(amount) as 金額合計
from public.phase_budget_items pbi
join public.projects p on p.id = pbi.project_id
where p.project_no = '2026-001';
