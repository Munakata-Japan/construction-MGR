/* ============================================================
   宗像総合管理システム  見積書AI転記モジュール
   BUILD: estimate-ai v20260914A
   ------------------------------------------------------------
   業者から届いた見積書(PDF/画像)を Claude で読み取り、明細を
   抽出→確認表で編集→呼び出し側(onImport)へ渡すだけの自己完結モジュール。
   DBへの書き込みは行わない（呼び出し側 genka.html が担当）。

   使い方:
     EstimateAI.open({
       partnerName: '博多鋼板工業株式会社',
       onImport: async (items) => { ...DBへ登録...; return true; }
     });

   ・APIキーはこのブラウザの localStorage にのみ保存。Anthropic以外へ送信しない。
   ・Grid Land MGR の toki-ai.js と同方式（api.anthropic.com へ直接 fetch）。
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'munakata_mgr_anthropic_api_key';
  const MODEL = 'claude-sonnet-5';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const getKey = () => { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } };
  const setKey = k => { try { k ? localStorage.setItem(STORAGE_KEY, k) : localStorage.removeItem(STORAGE_KEY); } catch (e) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const numOnly = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : null; };

  // ---- PDF.js を必要時に読み込む ----
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const el = document.createElement('script');
      el.src = src; el.onload = () => resolve(); el.onerror = () => reject(new Error('読み込み失敗: ' + src));
      document.head.appendChild(el);
    });
  }
  async function ensurePdfJs() {
    if (!window.pdfjsLib) await loadScript(PDFJS);
    if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc)
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }

  // ---- ファイル(PDF/画像) → dataURL画像の配列 ----
  async function fileToImages(file) {
    const t = (file.type || '').toLowerCase();
    if (t === 'image/jpeg' || t === 'image/png' || t === 'image/webp') {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('画像読込失敗')); r.readAsDataURL(file);
      });
      return [dataUrl];
    }
    await ensurePdfJs();
    if (!window.pdfjsLib) throw new Error('PDF.jsを読み込めませんでした（通信環境をご確認ください）');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const imgs = [];
    const pages = Math.min(pdf.numPages, 8); // 明細は先頭数ページ。過大送信を防ぐ
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2.0 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      imgs.push(cv.toDataURL('image/jpeg', 0.85));
    }
    return imgs;
  }

  const SYSTEM_PROMPT =
`あなたは日本の建設業の見積書から情報を抽出する専門家です。
添付画像の見積書を読み取り、次を構造化して抽出してください：仕入先名・明細（品名/数量/単価/金額）・小計・消費税・合計。

【仕入先名 vendor】
- 見積書を発行した会社名（自社「宗像総合開発」宛の「御中」ではなく、発行元＝仕入先の会社名）。例「博多鋼板工業株式会社」。

【明細 items（抽出する行）】
- 品名があり、数量・単価・金額のいずれかが入っている実際の明細行のみ。
- 単価・金額は消費税抜き（小計側）の数値を使う。

【明細に入れない行（重要）】
- 「※」で始まる注意書き・条件（例: シャー切曲、納期打ち合わせ、置き場渡し、見積有効期限 など）は明細ではない → items に入れない。
- 支払・入金・振込に関する条件（現金引換、振込、入金確認後 など）は一切取り込まない（このシステムは支払を扱わない）。
- 数量・単価・金額がすべて空、または金額0で品名が条件的な行は入れない。

【各明細の項目】
- name: 品名（型番・寸法もそのまま。例「(黒板)HOT 4.5x65x80x65x2438」）
- category: 内容から "material"（鋼材・資材・物品などモノ）か "labor"（加工・工事・施工・据付など作業）を判定
- quantity: 数量（数値のみ。無ければ null）
- unit: 単位（本・m・式・kg 等。表に無ければ null）
- unit_price: 税抜の単価（数値のみ。無ければ null）
- amount: 税抜の金額/合計（数値のみ。無ければ null。単価×数量で自明ならその値）
- note: 加工・寸法などの補足（例「切曲げ加工 8尺(約2438)」）。無ければ null

【totals（見積書の集計欄の数値）】
- subtotal: 小計（税抜）
- tax: 消費税
- total: 合計（税込）
- 読み取れない値は null。

【出力形式】JSON以外を一切含めず、次の1オブジェクトだけを返す:
{ "vendor": "博多鋼板工業株式会社",
  "items": [ { "name": "...", "category": "material", "quantity": 66, "unit": null, "unit_price": 4620, "amount": 304920, "note": null } ],
  "totals": { "subtotal": 304920, "tax": 30492, "total": 335412 } }
数値はカンマや¥を除いた半角数字。Markdownのコードブロックや前置きは禁止。`;

  async function callClaude(images, apiKey) {
    const content = images.map(dataUrl => {
      const m = /^data:(image\/[^;]+);base64,/.exec(dataUrl);
      return { type: 'image', source: { type: 'base64', media_type: m ? m[1] : 'image/jpeg', data: dataUrl.split(',')[1] } };
    });
    content.push({ type: 'text', text: 'この見積書の明細を、指示通りJSONだけで抽出してください。' });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM_PROMPT, messages: [{ role: 'user', content }] })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`APIエラー (${res.status}): ${t.substring(0, 300)}`);
    }
    return res.json();
  }

  function parseItems(resp) {
    const tc = (resp.content || []).find(c => c.type === 'text');
    if (!tc) throw new Error('AIの応答にテキストがありません');
    let raw = tc.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    let obj;
    try { obj = JSON.parse(raw); }
    catch (e) {
      const s = raw.indexOf('{'), en = raw.lastIndexOf('}');
      if (s < 0 || en < 0) throw new Error('AIの応答をJSONとして読めませんでした');
      obj = JSON.parse(raw.substring(s, en + 1));
    }
    const items = (Array.isArray(obj.items) ? obj.items : []).map(x => ({
      name: (x.name || '').toString().trim(),
      category: x.category === 'labor' ? 'labor' : 'material',
      quantity: numOnly(x.quantity),
      unit: x.unit ? String(x.unit).trim() : '',
      unit_price: numOnly(x.unit_price),
      amount: numOnly(x.amount),
      note: x.note ? String(x.note).trim() : ''
    })).filter(x => x.name);
    const t = obj.totals || {};
    return {
      vendor: obj.vendor ? String(obj.vendor).trim() : '',
      items,
      totals: { subtotal: numOnly(t.subtotal), tax: numOnly(t.tax), total: numOnly(t.total) }
    };
  }

  // ============================ UI ============================
  let ov = null;

  function close() { if (ov) { ov.remove(); ov = null; } }

  function reviewRowHtml(it) {
    return `<tr>
      <td><input class="eai-nm" value="${esc(it.name)}"></td>
      <td><select class="eai-cat">
        <option value="material"${it.category !== 'labor' ? ' selected' : ''}>材料</option>
        <option value="labor"${it.category === 'labor' ? ' selected' : ''}>工事</option>
      </select></td>
      <td><input class="eai-qty num" inputmode="decimal" value="${it.quantity ?? ''}"></td>
      <td><input class="eai-unit" value="${esc(it.unit)}"></td>
      <td><input class="eai-up num" inputmode="numeric" value="${it.unit_price ?? ''}"></td>
      <td><input class="eai-amt num" inputmode="numeric" value="${it.amount ?? ''}"></td>
      <td><input class="eai-note" value="${esc(it.note)}"></td>
      <td><button class="eai-del" title="この行を削除" type="button">×</button></td>
    </tr>`;
  }

  function collectRows() {
    return [...ov.querySelectorAll('#eaiTbody tr')].map(tr => ({
      name: tr.querySelector('.eai-nm').value.trim(),
      category: tr.querySelector('.eai-cat').value,
      quantity: numOnly(tr.querySelector('.eai-qty').value),
      unit: tr.querySelector('.eai-unit').value.trim() || null,
      unit_price: numOnly(tr.querySelector('.eai-up').value),
      amount: numOnly(tr.querySelector('.eai-amt').value),
      note: tr.querySelector('.eai-note').value.trim() || null
    })).filter(r => r.name);
  }

  function setStatus(msg, kind) {
    const el = ov.querySelector('#eaiStatus');
    el.textContent = msg || '';
    el.className = 'eai-status' + (kind ? ' ' + kind : '');
  }

  function open(opts) {
    opts = opts || {};
    close();
    ov = document.createElement('div');
    ov.className = 'eai-ov';
    ov.innerHTML = `
      <style>
        .eai-ov{ position:fixed; inset:0; z-index:9999; background:rgba(16,32,50,.55);
          display:flex; align-items:flex-start; justify-content:center; padding:24px; overflow:auto;
          font-family:var(--body,system-ui,sans-serif); }
        .eai-card{ background:#fff; width:min(1000px,96vw); border-radius:8px; box-shadow:0 18px 50px rgba(0,0,0,.35); overflow:hidden; }
        .eai-hd{ background:var(--ink,#13385D); color:#fff; padding:13px 18px; font-weight:800; font-size:15px; display:flex; align-items:center; gap:10px; }
        .eai-hd .x{ margin-left:auto; background:transparent; border:0; color:#fff; font-size:20px; cursor:pointer; line-height:1; }
        .eai-bd{ padding:16px 18px; }
        .eai-row{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
        .eai-bd input[type=password], .eai-bd input[type=text]{ min-height:40px; padding:8px 10px; font-size:14px; border:1px solid var(--rule,#C2C7C0); border-radius:6px; }
        .eai-key{ flex:1 1 320px; min-width:0; }
        .eai-file{ font-size:14px; }
        .eai-btn{ min-height:40px; padding:9px 16px; font-weight:800; font-size:14px; border-radius:6px; border:2px solid var(--ink,#13385D); background:var(--ink,#13385D); color:#fff; cursor:pointer; }
        .eai-btn.ghost{ background:#fff; color:var(--ink,#13385D); }
        .eai-btn:disabled{ opacity:.5; cursor:default; }
        .eai-note-s{ font-size:12px; color:var(--sub,#55684B); }
        .eai-status{ font-size:13px; margin:8px 0; min-height:18px; color:var(--sub,#55684B); }
        .eai-status.err{ color:var(--alert,#C53826); font-weight:700; }
        .eai-status.ok{ color:var(--ok,#238554); font-weight:700; }
        .eai-twrap{ overflow-x:auto; border:1px solid var(--rule,#C2C7C0); border-radius:6px; }
        table.eai-t{ border-collapse:collapse; width:100%; min-width:760px; font-size:13px; }
        .eai-t th, .eai-t td{ border-bottom:1px solid #E4E7E2; padding:4px 6px; text-align:left; }
        .eai-t th{ background:#F1F3EF; font-size:11.5px; color:var(--sub,#55684B); white-space:nowrap; }
        .eai-t input, .eai-t select{ width:100%; min-height:34px; padding:4px 6px; font-size:13px; border:1px solid var(--rule,#C2C7C0); border-radius:4px; box-sizing:border-box; }
        .eai-t input.num{ text-align:right; font-family:var(--mono,monospace); }
        .eai-t td:nth-child(1){ min-width:200px; } .eai-t td:nth-child(7){ min-width:140px; }
        .eai-del{ border:0; background:transparent; color:var(--alert,#C53826); font-size:18px; cursor:pointer; line-height:1; }
        .eai-ft{ display:flex; gap:8px; align-items:center; margin-top:12px; flex-wrap:wrap; }
        .eai-ft .sp{ flex:1 1 auto; }
        .eai-hide{ display:none; }
      </style>
      <div class="eai-card">
        <div class="eai-hd">🤖 見積書AI転記　<span style="font-weight:600;font-size:13px">${esc(opts.partnerName || '')}</span>
          <button class="x" id="eaiClose" type="button" title="閉じる">×</button></div>
        <div class="eai-bd">
          <div class="eai-row">
            <input type="password" class="eai-key" id="eaiKey" placeholder="Anthropic APIキー（sk-ant-…）" value="${esc(getKey())}" autocomplete="off">
            <button class="eai-btn ghost" id="eaiKeyShow" type="button">表示</button>
            <button class="eai-btn ghost" id="eaiKeySave" type="button">キー保存</button>
          </div>
          <div class="eai-note-s">※ APIキーはこのブラウザにのみ保存され、Anthropic以外へ送信されません。</div>
          <div class="eai-row" style="margin-top:12px">
            <input type="file" class="eai-file" id="eaiFile" accept="application/pdf,image/jpeg,image/png,image/webp">
            <button class="eai-btn" id="eaiRun" type="button">読み取る</button>
          </div>
          <div class="eai-status" id="eaiStatus"></div>
          <div id="eaiMeta" class="eai-hide" style="margin:6px 0 10px;font-size:13px">
            <div>仕入先名（読取）：<b id="eaiVendor"></b></div>
            <div id="eaiTotals" class="eai-note-s" style="margin-top:3px"></div>
          </div>
          <div id="eaiReview" class="eai-hide">
            <div class="eai-twrap">
              <table class="eai-t">
                <thead><tr><th>品名</th><th>区分</th><th>数量</th><th>単位</th><th>単価(税抜)</th><th>金額(税抜)</th><th>備考</th><th></th></tr></thead>
                <tbody id="eaiTbody"></tbody>
              </table>
            </div>
            <div class="eai-ft">
              <button class="eai-btn ghost" id="eaiAdd" type="button">＋ 行を足す</button>
              <span class="sp"></span>
              <span class="eai-note-s" id="eaiSum"></span>
              <button class="eai-btn" id="eaiSave" type="button">この見積先に登録</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const $ = id => ov.querySelector('#' + id);
    let docTotals = null;
    const yen = n => (n == null ? '—' : '¥' + Number(n).toLocaleString());
    $('eaiClose').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    const keyInput = $('eaiKey');
    $('eaiKeyShow').onclick = () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      $('eaiKeyShow').textContent = show ? '隠す' : '表示';
    };
    $('eaiKeySave').onclick = () => { setKey(keyInput.value.trim()); setStatus('APIキーを保存しました。', 'ok'); };

    function refreshSum() {
      const rows = collectRows();
      const total = rows.reduce((a, r) => a + (r.amount || (r.unit_price != null && r.quantity != null ? r.unit_price * r.quantity : 0) || 0), 0);
      let msg = `明細 ${rows.length} 件　税抜合計 ${yen(total)}`;
      if (docTotals && docTotals.subtotal != null && Math.abs(docTotals.subtotal - total) > 0)
        msg += `　⚠ 見積書の小計 ${yen(docTotals.subtotal)} と差があります`;
      $('eaiSum').textContent = msg;
    }

    function bindTable() {
      const tb = $('eaiTbody');
      tb.oninput = refreshSum;
      tb.onclick = e => { const b = e.target.closest('.eai-del'); if (b) { b.closest('tr').remove(); refreshSum(); } };
    }

    $('eaiAdd').onclick = () => {
      $('eaiTbody').insertAdjacentHTML('beforeend', reviewRowHtml({ name: '', category: 'material', quantity: null, unit: '', unit_price: null, amount: null, note: '' }));
      refreshSum();
    };

    $('eaiRun').onclick = async () => {
      const apiKey = keyInput.value.trim();
      if (!apiKey) { setStatus('APIキーを入力してください。', 'err'); return; }
      const file = $('eaiFile').files[0];
      if (!file) { setStatus('見積書のPDFまたは画像を選んでください。', 'err'); return; }
      setKey(apiKey);
      $('eaiRun').disabled = true;
      try {
        setStatus('見積書を画像に変換しています…');
        const images = await fileToImages(file);
        setStatus(`AIが読み取っています…（${images.length}ページ）`);
        const resp = await callClaude(images, apiKey);
        const data = parseItems(resp);
        const items = data.items;
        docTotals = data.totals;
        $('eaiVendor').textContent = data.vendor || '（読み取れませんでした）';
        $('eaiTotals').textContent =
          `小計 ${yen(docTotals.subtotal)}　／　消費税 ${yen(docTotals.tax)}　／　合計 ${yen(docTotals.total)}（見積書の記載）`;
        $('eaiMeta').classList.remove('eai-hide');
        if (!items.length) { setStatus('明細を読み取れませんでした。別のページ／画像でお試しください。', 'err'); $('eaiRun').disabled = false; return; }
        $('eaiTbody').innerHTML = items.map(reviewRowHtml).join('');
        bindTable();
        $('eaiReview').classList.remove('eai-hide');
        refreshSum();
        setStatus(`${items.length} 件を読み取りました。内容を確認・修正して「この見積先に登録」を押してください。`, 'ok');
      } catch (err) {
        setStatus('読み取りに失敗しました：' + (err && err.message ? err.message : err), 'err');
      }
      $('eaiRun').disabled = false;
    };

    $('eaiSave').onclick = async () => {
      const rows = collectRows();
      if (!rows.length) { setStatus('登録できる明細がありません。', 'err'); return; }
      if (typeof opts.onImport !== 'function') { setStatus('登録処理が接続されていません。', 'err'); return; }
      $('eaiSave').disabled = true;
      setStatus('登録しています…');
      try {
        await opts.onImport(rows);
        setStatus(`${rows.length} 件を登録しました。`, 'ok');
        setTimeout(close, 700);
      } catch (err) {
        setStatus('登録に失敗しました：' + (err && err.message ? err.message : err), 'err');
        $('eaiSave').disabled = false;
      }
    };
  }

  window.EstimateAI = { open };
})();
