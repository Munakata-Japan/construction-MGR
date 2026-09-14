/* ============================================================
   宗像総合管理システム  共通処理
   BUILD: common.js v20260906B
   ============================================================ */

/* ---------- 最新版をすぐ反映する（Service Worker・ネットワーク優先） ----------
   GitHub Pages はHTMLに no-cache ヘッダーを付けられず、変更後に
   ハード再読み込みが要りがちだった。ネットワーク優先のSWを常駐させ、
   オンライン時は常に最新を取りに行くようにする（普通のリロードで反映）。
------------------------------------------------------------------ */
if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

const STATUS = {
  estimate : '見積',
  ordered  : '受注',
  started  : '着工',
  completed: '完工',
  invoiced : '請求済',
  paid     : '入金済',
  cancelled: '中止'
};

const ROLE_LABEL = { admin:'管理者', manager:'現場監督', member:'作業員' };

/* ================= 権限5区分（①〜⑤） =================
   既存の role＋is_external＋employee_type から導出する。DB変更は不要。
   ① 経営者 / ② 現場監督 / ③ 一般社員 / ④ 外注社員 / ⑤ 協力業者（社外） */
const TIERS = [
  { n:1, key:'exec',    label:'経営者',   side:'in' },
  { n:2, key:'manager', label:'現場監督', side:'in' },
  { n:3, key:'staff',   label:'一般社員', side:'in' },
  { n:4, key:'outsrc',  label:'外注社員', side:'in' },
  { n:5, key:'partner', label:'協力業者', side:'ex' },
];
function tierOf(u){
  if (!u) return 3;
  if (u.is_external) return 5;                       // 協力業者（社外）
  if (u.role === 'admin')   return 1;                // 経営者
  if (u.role === 'manager') return 2;                // 現場監督
  if (u.employee_type === 'subcontractor') return 4; // 外注社員
  return 3;                                          // 一般社員
}
function tierLabel(n){ const t = TIERS.find(x => x.n === n); return t ? t.label : ''; }

/* ---------- 竣工図書の章立て（民間工事の標準）----------
   写真・書類（project_files.doc_category）を、この章に振り分けて
   竣工図書として積み上げる。files.html で分類・handover.html で整理／印刷。
   会社・発注者ごとの追加は、この配列に足すだけで両画面へ反映される。
------------------------------------------------------------ */
const HANDOVER_CHAPTERS = [
  { key:'gaiyou',   label:'工事概要' },
  { key:'plan',     label:'施工計画書' },
  { key:'permit',   label:'届出・許認可' },
  { key:'safety',   label:'安全衛生書類' },
  { key:'quality',  label:'品質・出来形記録' },
  { key:'photo',    label:'工事写真帳' },
  { key:'drawing',  label:'竣工図' },
  { key:'inspect',  label:'検査記録' },
  { key:'warranty', label:'保証書・その他' }
];
function chapterLabel(key){
  const c = HANDOVER_CHAPTERS.find(x => x.key === key);
  return c ? c.label : '';
}
function chapterOptions(sel){
  return HANDOVER_CHAPTERS
    .map(c => `<option value="${c.key}"${c.key === sel ? ' selected' : ''}>${esc(c.label)}</option>`)
    .join('');
}

/* ---------- 竣工図書：資料名の自動タグ（章名・No.・撮影日）----------
   章に分類されると、元のファイル名の拡張子の前へ （章名・No.X・撮影日）を付け、
   後から検索できるようにする。章の移動・並べ替えのたびに古いタグを外して付け直す。
   DB列は増やさず、タグは元ファイル名から機械的に外して基準名を復元する
   （タグには必ず "No.数字" が入るので、既存の "(1)" 等とは取り違えない）。
------------------------------------------------------------------ */
function docNameParts(name){
  const m = /^(.*?)(\.[^.\/\\]+)?$/.exec(name || '');
  return { stem: m[1] || '', ext: m[2] || '' };
}
function stripDocTag(name){
  if (!name) return name || '';
  const { stem, ext } = docNameParts(name);
  return stem.replace(/（[^（）]*No\.\d+[^（）]*）\s*$/, '') + ext;
}
function buildDocName(baseFileName, chapterKey, no, takenOn){
  if (!chapterKey) return baseFileName;                 // 未分類は素のファイル名に戻す
  const { stem, ext } = docNameParts(baseFileName);
  const tag = [chapterLabel(chapterKey), 'No.' + no, takenOn || ''].filter(Boolean).join('・');
  return `${stem}（${tag}）${ext}`;
}
/* 指定した章の中を並び順で採番し、original_name のタグと sort_order を付け直してDB保存する。
   files はページが保持する project_files 配列（その場で書き換える）。戻り値＝更新件数。 */
async function applyChapterNames(files, chapterKey){
  const bySort = (a, b) => ((a.sort_order || 0) - (b.sort_order || 0)) ||
                           ((a.taken_on || '') < (b.taken_on || '') ? 1 : -1);
  const arr = files.filter(x => (x.doc_category || '') === chapterKey).sort(bySort);
  const ups = [];
  arr.forEach((x, i) => {
    const no = i + 1, so = (i + 1) * 10;
    const base = stripDocTag(x.original_name || '');
    const nm = chapterKey ? buildDocName(base, chapterKey, no, x.taken_on) : base;
    const patch = {};
    if (chapterKey && (x.sort_order || 0) !== so) patch.sort_order = so;   // 採番は章内のみ（未分類は並び替えない）
    if ((x.original_name || '') !== nm) patch.original_name = nm;          // 未分類は古いタグを外すだけ
    if (Object.keys(patch).length){ ups.push({ id: x.id, patch }); Object.assign(x, patch); }
  });
  if (ups.length) await Promise.all(ups.map(u => sb.from('project_files').update(u.patch).eq('id', u.id)));
  return ups.length;
}

/* ---------- 表示の整形 ---------- */
function fmtMoney(v){
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return '¥' + n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

function fmtDate(v){
  if (!v) return '';
  const d = new Date(v + 'T00:00:00');
  if (isNaN(d)) return v;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

/* ---------- 画面上の通知 ---------- */
function showMsg(el, text, kind){
  if (!el) return;
  el.className = 'msg ' + (kind || '');
  el.textContent = text || '';
  // 前回の自動消去タイマーを止める（要素ごとに1本だけ持つ）
  if (el._msgTimer){ clearTimeout(el._msgTimer); el._msgTimer = null; }
  if (text){
    el.scrollIntoView({ block:'nearest' });
    // 通知は一定時間で自動的に消す（古いエラー帯や案内が画面に残り続けないように）
    el._msgTimer = setTimeout(() => { el.textContent = ''; el.className = 'msg'; el._msgTimer = null; },
      kind === 'err' ? 9000 : 5000);
  }
}

/* ---------- 削除の取り消し（元に戻す） ----------
   削除した直後に「元に戻す」ボタン付きの通知を出す。
   undoFn は、控えておいた内容を入れ直す非同期関数。
   これで、削除ボタンのある画面はどこでも復元できる。
------------------------------------------------ */
function showUndo(el, text, undoFn){
  if (!el){ return; }
  el.className = 'msg ok';
  el.innerHTML = `<span>${esc(text)}</span>` +
    `<button type="button" class="undobtn" style="margin-left:12px;font-weight:700;` +
    `text-decoration:underline;background:none;border:none;color:var(--ink-2);cursor:pointer;font-size:13px">` +
    `元に戻す</button>`;
  const btn = el.querySelector('.undobtn');
  let used = false;
  btn.addEventListener('click', async () => {
    if (used) return;
    used = true; btn.disabled = true; btn.textContent = '元に戻しています…';
    try {
      await undoFn();
      el.className = 'msg ok'; el.textContent = '元に戻しました。';
    } catch (e){
      el.className = 'msg err'; el.textContent = '元に戻せませんでした。' + (e.message || '');
    }
  });
  el.scrollIntoView({ block:'nearest' });
}

/* ---------- 事前登録が必要なドロップダウンの空欄アナウンス ----------
   取引先・工程・利用者などのマスタが1件も無いまま選択肢が空の
   セレクトを黙って出すと、登録し忘れなのか本当に無いのか分からない。
   セレクトの直後に注意書きを出し、必要ならページへの導線も添える。
------------------------------------------------------------------ */
function setEmptyNote(selectEl, isEmpty, text, href, linkLabel){
  if (!selectEl) return;
  let note = selectEl.nextElementSibling;
  if (!note || !note.classList || !note.classList.contains('emptynote')){
    note = document.createElement('div');
    note.className = 'emptynote';
    selectEl.insertAdjacentElement('afterend', note);
  }
  note.innerHTML = href
    ? `${esc(text)}　<a href="${esc(href)}">${esc(linkLabel || 'こちらから登録')}</a>`
    : esc(text);
  note.hidden = !isEmpty;
}

/* ---------- ログイン確認 ----------
   ログインしていなければログイン画面へ戻す。
   戻り値: { session, me }  me は app_users の1行
------------------------------------ */
async function requireAuth(){
  const { data:{ session } } = await sb.auth.getSession();
  if (!session){
    const back = location.pathname.split('/').pop() + location.search;
    location.replace('index.html?next=' + encodeURIComponent(back));
    return null;
  }

  let { data:me, error } = await sb
    .from('app_users')
    .select('id, name, role, organization_id, employee_type, department, is_external')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error){
    alert('利用者情報を読み込めませんでした。\n' + error.message);
    return null;
  }

  // メール確認が必要な設定のときは、招待からの登録直後はまだ紐づいていない。
  // 確認後の初回ログインでここに来るので、覚えておいた招待トークンで紐づけ直す。
  if (!me){
    let pending = null;
    try { pending = localStorage.getItem('pending_invite_token'); } catch (e) {}
    if (pending){
      const { data: ok } = await sb.rpc('claim_invite', { p_token: pending });
      try { localStorage.removeItem('pending_invite_token'); } catch (e) {}
      if (ok){
        ({ data:me, error } = await sb
          .from('app_users')
          .select('id, name, role, organization_id, employee_type, department, is_external')
          .eq('auth_user_id', session.user.id)
          .maybeSingle());
      }
    }
  }

  if (!me){
    alert('このアカウントはまだ会社に登録されていません。\n管理者に利用者の追加を依頼してください。');
    await sb.auth.signOut();
    location.replace('index.html');
    return null;
  }
  startPresence();
  return { session, me };
}

/* ---------- ログイン中の人数のための在席打刻 ----------
   画面を開いて操作している間だけ、一定間隔で本人の最終アクセス
   時刻を記録する。画面を見ていない間（タブが背面・スマホ画面オフ）は
   打刻を止めるので、操作をやめて数分たつと自動的に「ログイン中」から外れる。
------------------------------------------------------------------ */
let _presenceTimer = null;
function startPresence(){
  const beat = () => {
    if (document.visibilityState === 'hidden') return;
    sb.rpc('touch_presence').then(() => {}, () => {});
  };
  beat();
  if (_presenceTimer) clearInterval(_presenceTimer);
  _presenceTimer = setInterval(beat, 60000);   // 1分ごと
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') beat();
  });
}

/* ---------- 見出し帯に利用者を表示 ---------- */
function paintBar(me, orgName){
  const who = document.getElementById('who');
  if (!who) return;
  who.innerHTML = `<b>${esc(ROLE_LABEL[me.role] || me.role)}</b>${esc(orgName || '')}`;
}

async function loadOrgName(orgId){
  const { data } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
  return data ? data.name : '';
}

/* ---------- 画像の縮小 ---------- */
function shrinkImage(file, maxEdge, quality){
  return new Promise(res => {
    if (!file.type || !file.type.startsWith('image/')) return res(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const sc = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cv.toBlob(b => { URL.revokeObjectURL(url); res(b ? { blob:b, w:img.width, h:img.height } : null); },
                'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

/* ---------- PDFの1ページ目を絵にする ----------
   図面がPDFのとき、中身が見えないと意味がないため、
   1ページ目だけを画像に変換して一覧に出す。
   読み込みは必要になったときだけ行う。
------------------------------------------------ */
let _pdfReady = null;
function loadPdfLib(){
  if (_pdfReady) return _pdfReady;
  _pdfReady = new Promise((res, rej) => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      if (!window.pdfjsLib) return rej(new Error('PDFの読み込みに失敗しました'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      res(window.pdfjsLib);
    };
    s.onerror = () => rej(new Error('PDFの読み込みに失敗しました'));
    document.head.appendChild(s);
  });
  return _pdfReady;
}

async function pdfThumb(file, maxEdge){
  if (!file || file.type !== 'application/pdf') return null;
  try {
    const lib = await loadPdfLib();
    const buf = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buf }).promise;
    const page = await doc.getPage(1);
    const v0 = page.getViewport({ scale: 1 });
    const sc = Math.min(3, (maxEdge || 1200) / Math.max(v0.width, v0.height));
    const vp = page.getViewport({ scale: sc });
    const cv = document.createElement('canvas');
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
  } catch (e){
    console.error('PDFの絵づくりに失敗', e);
    return null;
  }
}

/* ---------- 取り込んだファイルの表示用画像をつくる ----------
   画像なら縮小、PDFなら1ページ目。どちらでもなければ null。
------------------------------------------------------------ */
async function makeThumb(file, maxEdge, quality){
  if (file.type && file.type.startsWith('image/')){
    const r = await shrinkImage(file, maxEdge, quality || 0.75);
    return r ? r.blob : null;
  }
  if (file.type === 'application/pdf') return await pdfThumb(file, maxEdge);
  return null;
}

/* ---------- 取り込み時の圧縮（PDF）とMIME判定 ----------
   PDF（特にスキャン・画像主体）は原本のままだと重く、開くのに時間がかかる。
   取り込み時に各ページを提出品質(既定150dpi・JPEG)で作り直して小さくする。
   テキスト/ベクタ主体で縮まないPDFは劣化を避けるため原本を使う（呼び出し側で判定）。
------------------------------------------------------------------ */
let _jspdfReady = null;
function loadJsPdf(){
  if (_jspdfReady) return _jspdfReady;
  _jspdfReady = new Promise((res, rej) => {
    if (window.jspdf && window.jspdf.jsPDF) return res(window.jspdf.jsPDF);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? res(window.jspdf.jsPDF) : rej(new Error('jsPDFの読み込みに失敗しました'));
    s.onerror = () => rej(new Error('jsPDFの読み込みに失敗しました'));
    document.head.appendChild(s);
  });
  return _jspdfReady;
}

/* 拡張子・種類からMIMEを決める（アップロードのcontent-type用。PDFを application/pdf で
   保存しておくと、開いたとき即ストリーム表示できる＝真っ黒/待ちを防ぐ）。 */
function mimeOf(file){
  if (file.type) return file.type;
  const n = (file.name || '').toLowerCase();
  if (/\.pdf$/.test(n)) return 'application/pdf';
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  if (/\.png$/.test(n))  return 'image/png';
  if (/\.gif$/.test(n))  return 'image/gif';
  if (/\.webp$/.test(n)) return 'image/webp';
  return 'application/octet-stream';
}

/* PDFを提出品質に圧縮。成功で Blob、失敗や対象外は null（原本を使う）。 */
async function compressPdf(file, dpi, quality){
  dpi = dpi || 150; quality = quality || 0.72;
  try {
    const lib = await loadPdfLib();
    const jsPDF = await loadJsPdf();
    const buf = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buf }).promise;
    let out = null;
    for (let i = 1; i <= doc.numPages; i++){
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: dpi / 72 });
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(vp.width));
      cv.height = Math.max(1, Math.round(vp.height));
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const img = cv.toDataURL('image/jpeg', quality);
      const wPt = cv.width * 72 / dpi, hPt = cv.height * 72 / dpi;
      if (!out) out = new jsPDF({ unit: 'pt', format: [wPt, hPt], compress: true });
      else out.addPage([wPt, hPt]);
      out.addImage(img, 'JPEG', 0, 0, wPt, hPt);
      cv.width = cv.height = 0;
    }
    return out ? out.output('blob') : null;
  } catch (e){ console.error('compressPdf failed', e); return null; }
}

/* 取り込むファイルを保存用に整える。画像は縮小、PDF（大きめ）は圧縮を試し、
   縮んだときだけ採用する。戻り値 { blob, width, height }。 */
async function prepUpload(file, opts){
  opts = opts || {};
  const edge = opts.edge || 1600, q = opts.quality || 0.80;
  if (file.type && file.type.startsWith('image/')){
    const r = await shrinkImage(file, edge, q);
    return r ? { blob: r.blob, width: r.w, height: r.h } : { blob: file, width: null, height: null };
  }
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (isPdf && file.size > 1200000){
    const c = await compressPdf(file, opts.pdfDpi || 150, opts.pdfQuality || 0.72);
    if (c && c.size < file.size * 0.85) return { blob: c, width: null, height: null };
  }
  return { blob: file, width: null, height: null };
}

/* ---------- 写真に記録された位置と撮影日時 ---------- */
function readExifGeo(file){
  return new Promise(res => {
    if (!file || !/jpe?g/i.test(file.type || '')) return res(null);

    const fr = new FileReader();
    fr.onerror = () => res(null);
    fr.onload = () => {
      try { res(parseExif(new DataView(fr.result))); }
      catch (e){ res(null); }
    };
    // 先頭 256KB だけ読めば Exif は足りる
    fr.readAsArrayBuffer(file.slice(0, 262144));
  });
}

function parseExif(dv){
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return null;   // JPEG か

  // APP1（Exif）の位置を探す
  let off = 2, app1 = -1;
  while (off + 4 < dv.byteLength){
    if (dv.getUint8(off) !== 0xFF) break;
    const marker = dv.getUint8(off + 1);
    const size   = dv.getUint16(off + 2);
    if (marker === 0xE1){
      if (dv.getUint32(off + 4) === 0x45786966){ app1 = off + 10; break; }  // "Exif"
    }
    if (marker === 0xDA) break;                                            // 画像本体
    off += 2 + size;
  }
  if (app1 < 0) return null;

  // TIFF ヘッダ
  const bo = dv.getUint16(app1);
  const le = (bo === 0x4949);                       // 0x4949=リトル / 0x4D4D=ビッグ
  if (!le && bo !== 0x4D4D) return null;
  if (dv.getUint16(app1 + 2, le) !== 42) return null;

  const ifd0 = app1 + dv.getUint32(app1 + 4, le);
  const out = { lat:null, lng:null, at:null };

  const readIfd = (base, want) => {
    const found = {};
    if (base + 2 > dv.byteLength) return found;
    const n = dv.getUint16(base, le);
    for (let i = 0; i < n; i++){
      const e = base + 2 + i * 12;
      if (e + 12 > dv.byteLength) break;
      const tag = dv.getUint16(e, le);
      if (!want.includes(tag)) continue;
      found[tag] = {
        type : dv.getUint16(e + 2, le),
        count: dv.getUint32(e + 4, le),
        valOf: e + 8
      };
    }
    return found;
  };

  const valueOffset = (ent, unitBytes) => {
    const total = ent.count * unitBytes;
    return total > 4 ? app1 + dv.getUint32(ent.valOf, le) : ent.valOf;
  };

  const ratio = (p) => {
    const a = dv.getUint32(p, le), b = dv.getUint32(p + 4, le);
    return b ? a / b : 0;
  };

  const ascii = (ent) => {
    const p = valueOffset(ent, 1);
    let s = '';
    for (let i = 0; i < ent.count - 1; i++){
      const c = dv.getUint8(p + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  // IFD0 から GPS と Exif への入口を得る
  const top = readIfd(ifd0, [0x8825, 0x8769]);

  // 撮影日時
  if (top[0x8769]){
    const exifBase = app1 + dv.getUint32(top[0x8769].valOf, le);
    const ex = readIfd(exifBase, [0x9003]);           // DateTimeOriginal
    if (ex[0x9003]){
      const s = ascii(ex[0x9003]);                    // "2026:07:23 14:32:10"
      const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
      if (m) out.at = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
    }
  }

  // GPS
  if (top[0x8825]){
    const gpsBase = app1 + dv.getUint32(top[0x8825].valOf, le);
    const g = readIfd(gpsBase, [0x0001, 0x0002, 0x0003, 0x0004]);

    const dms = (ent) => {
      if (!ent || ent.count < 3) return null;
      const p = valueOffset(ent, 8);
      return ratio(p) + ratio(p + 8) / 60 + ratio(p + 16) / 3600;
    };
    const ref = (ent) => ent ? String.fromCharCode(dv.getUint8(ent.valOf)) : '';

    const la = dms(g[0x0002]), ln = dms(g[0x0004]);
    if (la !== null && ln !== null && (la || ln)){
      out.lat = (ref(g[0x0001]) === 'S') ? -la : la;
      out.lng = (ref(g[0x0003]) === 'W') ? -ln : ln;
    }
  }

  return (out.lat !== null || out.at) ? out : null;
}

/* ---------- 端末から今の位置を取る ---------- */
function currentPosition(timeoutMs){
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => res(null),
      { enableHighAccuracy: true, timeout: timeoutMs || 8000, maximumAge: 30000 }
    );
  });
}

/* ---------- 写真1枚分の位置を決める ----------
   写真に記録されていればそれを使う。
   無ければ端末の位置を使う（現場で撮ってその場で取り込む場合に有効）。
------------------------------------------------ */
async function resolveGeo(file, devicePos){
  const ex = await readExifGeo(file);
  if (ex && ex.lat !== null){
    return { lat: ex.lat, lng: ex.lng, source: 'exif', acc: null, at: ex.at };
  }
  if (devicePos){
    return { lat: devicePos.lat, lng: devicePos.lng, source: 'device',
             acc: devicePos.acc, at: ex ? ex.at : null };
  }
  return { lat: null, lng: null, source: 'none', acc: null, at: ex ? ex.at : null };
}

/* ---------- ログアウト ---------- */
async function signOut(){
  // 「出る」は誤タップでシステムからログアウトしてしまうため、必ず確認する
  if (!confirm('システムからログアウトします。よろしいですか。\n（作業を続けるときは「メニュー」からお戻りください）')) return;
  await sb.auth.signOut();
  location.replace('index.html');
}

/* ---------- メニューへ戻る導線 ----------
   全画面の見出し帯に自動で挿入する。
   新しい画面を作ったときも、common.js を読み込むだけで付く。
   ログイン画面とメニュー自身には付けない。
------------------------------------------ */
(function insertBack(){
  const here = location.pathname.split('/').pop() || 'index.html';
  if (/^(index|mode-select|report-entry|signup)\.html$/.test(here)) return;

  // 作業のために別ページから来たか（メニュー・ログイン・直接アクセスは除く）。
  // 来ていれば「戻る」で元居たページへ、そうでなければ「メニュー」へ。
  let backToPrev = false;
  try {
    if (document.referrer){
      const ref = new URL(document.referrer);
      const rf = ref.pathname.split('/').pop() || '';
      if (ref.origin === location.origin && rf && rf !== here &&
          !/^(index|mode-select|report-entry|signup)\.html$/.test(rf)){
        backToPrev = true;
      }
    }
  } catch (e) {}

  function put(){
    const bar = document.querySelector('.bar');
    if (!bar) return;
    if (bar.querySelector('.backbtn')) return;

    const a = document.createElement('a');
    a.className = 'btn ghost sm barbtn backbtn';
    if (backToPrev){
      a.href = '#';
      a.textContent = '◂ 戻る';
      a.addEventListener('click', e => {
        e.preventDefault();
        if (history.length > 1) history.back(); else location.href = 'mode-select.html';
      });
    } else {
      a.href = 'mode-select.html';
      a.textContent = '◂ メニュー';
    }

    const mark = bar.querySelector('.mark');
    if (mark) mark.after(a); else bar.prepend(a);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', put);
  } else {
    put();
  }
})();

/* ============================================================
   ホーム画面に追加（PWAインストール案内）— 全ページ標準
   ・アプリとして起動中／PC では出さない
   ・Android＝ワンタップ導入（beforeinstallprompt）
   ・iPhone＝Safariの「ホーム画面に追加」を案内（Apple仕様で全自動は不可）
   ・LINE等アプリ内ブラウザ＝ブラウザで開くよう案内（この状態では追加不可）
============================================================ */
(function(){
  var ua = navigator.userAgent || '';
  var isIOS = /iP(hone|ad|od)/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var inApp = /(Line|FBAN|FBAV|Instagram|Twitter|Messenger|MicroMessenger)/i.test(ua);
  var standalone = (window.matchMedia &&
                    window.matchMedia('(display-mode: standalone)').matches) ||
                   navigator.standalone === true;

  if (standalone) return;             // 既にアプリとして起動中
  if (!isIOS && !isAndroid) return;   // PCは対象外

  try {
    var until = parseInt(localStorage.getItem('a2hs_snooze') || '0', 10);
    if (until && until > Date.now()) return;   // 「あとで」から一定期間は非表示
  } catch (e) {}
  function snooze(days){ try { localStorage.setItem('a2hs_snooze', String(Date.now() + days*864e5)); } catch(e){} }

  var deferred = null, ready = false, shown = false;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred = e;
    if (ready && !shown) show('android');
  });

  function style(){
    if (document.getElementById('a2hs-style')) return;
    var s = document.createElement('style'); s.id = 'a2hs-style';
    s.textContent =
      '.a2hs{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;'+
      'border-top:3px solid var(--safety,#EAA800);box-shadow:0 -6px 22px rgba(0,0,0,.18);'+
      'padding:10px 12px calc(10px + env(safe-area-inset-bottom));'+
      'font-family:var(--body,"Noto Sans JP",system-ui,sans-serif);animation:a2up .25s ease}'+
      '@keyframes a2up{from{transform:translateY(100%)}to{transform:translateY(0)}}'+
      '.a2hs .rw{display:flex;align-items:center;gap:10px}'+
      '.a2hs img{width:40px;height:40px;border-radius:10px;flex:0 0 auto}'+
      '.a2hs .tx{flex:1 1 auto;min-width:0}'+
      '.a2hs .tx b{display:block;font-size:14px;color:var(--ink,#13385D);line-height:1.3}'+
      '.a2hs .tx span{display:block;font-size:12px;color:var(--sub,#5a6e82);margin-top:2px}'+
      '.a2hs .act{flex:0 0 auto;background:var(--ink,#13385D);color:#fff;border:0;border-radius:9px;'+
      'padding:10px 15px;font-size:13px;font-weight:700;cursor:pointer}'+
      '.a2hs .x{flex:0 0 auto;background:transparent;border:0;color:#9aa8b5;font-size:22px;'+
      'line-height:1;padding:2px 6px;cursor:pointer}'+
      '.a2hs .guide{margin-top:9px;font-size:13px;color:var(--ink,#13385D);line-height:1.75;'+
      'background:var(--paper,#EBEDE8);border-radius:9px;padding:10px 12px}'+
      '.a2hs .guide ol{margin:0;padding-left:1.25em}'+
      '.a2hs .guide .k{display:inline-block;min-width:20px;height:20px;line-height:20px;text-align:center;'+
      'background:var(--ink,#13385D);color:#fff;border-radius:6px;font-size:12px;padding:0 5px;margin:0 2px}';
    document.head.appendChild(s);
  }

  function show(mode){
    if (shown) return; shown = true;
    style();
    var bar = document.createElement('div');
    bar.className = 'a2hs';

    var titles = {
      ios:'アプリのように使えます', android:'アプリのように使えます',
      inapp:'ブラウザで開いてください'
    };
    var subs = {
      ios:'ホーム画面に追加すると全画面で起動します',
      android:'ホーム画面に追加すると全画面で起動します',
      inapp:'LINE内のままではホーム画面に追加できません'
    };
    var btns = { ios:'追加する', android:'アプリを追加', inapp:'URLをコピー' };

    bar.innerHTML =
      '<div class="rw">'+
        '<img src="icons/apple-touch-icon.png" alt="">'+
        '<div class="tx"><b>'+titles[mode]+'</b><span>'+subs[mode]+'</span></div>'+
        '<button class="act" type="button">'+btns[mode]+'</button>'+
        '<button class="x" type="button" aria-label="閉じる">&times;</button>'+
      '</div>'+
      '<div class="guide" hidden></div>';

    var act = bar.querySelector('.act');
    var guide = bar.querySelector('.guide');
    bar.querySelector('.x').addEventListener('click', function(){ snooze(14); bar.remove(); });

    function openGuide(html){ guide.innerHTML = html; guide.hidden = false; }

    act.addEventListener('click', async function(){
      if (mode === 'android'){
        if (deferred){
          deferred.prompt();
          try { await deferred.userChoice; } catch(e){}
          deferred = null; bar.remove();
        } else {
          openGuide('<ol><li>右上の <span class="k">⋮</span> をタップ</li>'+
                    '<li><b>「アプリをインストール」</b>（または「ホーム画面に追加」）をタップ</li></ol>');
        }
      } else if (mode === 'ios'){
        openGuide('<ol><li>画面下の <b>共有ボタン</b> <span class="k">□↑</span> をタップ</li>'+
                  '<li>メニューを下にスクロールし <b>「ホーム画面に追加」</b> をタップ</li>'+
                  '<li>右上の <b>「追加」</b> をタップ</li></ol>');
      } else { // inapp
        try {
          await navigator.clipboard.writeText(location.href);
          openGuide('URLをコピーしました。<br>'+
            (isIOS ? '右上または下の <span class="k">…</span> から <b>「Safariで開く」</b>、または Safari に貼り付けて開いてください。'
                   : '右上の <span class="k">⋮</span> から <b>「ブラウザで開く」</b>、または Chrome に貼り付けて開いてください。'));
        } catch(e){
          openGuide('このページのURLを Safari／Chrome で開き直してください。');
        }
      }
    });

    document.body.appendChild(bar);
  }

  function start(){
    ready = true;
    if (inApp) return show('inapp');
    if (isIOS) return show('ios');
    if (isAndroid) return show('android'); // deferredが無くても案内にフォールバック
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ============================================================
   多言語対応（日本語 / 简体中文 / English）— 全ページ共通
   ------------------------------------------------------------
   ヘッダーに言語スイッチを追加。ページ内の日本語UI文字列を辞書で照合して
   選択言語へ置換する（要素ごとのタグ付け不要）。動的に描画される一覧・表は
   MutationObserver で自動翻訳。辞書に無い語・データ（氏名/数値/日付等）は
   そのまま日本語のまま＝壊れない。曖昧語（例：単独の「工事」）は誤訳を避け
   あえて未収録にしている。辞書は随時追加で網羅度を上げられる。
============================================================ */
(function(){
  const LANGS = [['ja','🌐 日本語'],['zh','🌐 简体中文'],['en','🌐 English']];
  const KEY = 'mgr_lang';
  function getLang(){ try{ return localStorage.getItem(KEY) || 'ja'; }catch(e){ return 'ja'; } }
  function setLang(l){ try{ localStorage.setItem(KEY, l); }catch(e){} }

  // 日本語 → { zh:簡体字, en:English }
  const DICT = {
    '宗像総合管理システム':{zh:'宗像综合管理系统',en:'Munakata Management System'},
    '管理者':{zh:'管理员',en:'Administrator'},'経営者':{zh:'经营者',en:'Executive'},
    '現場監督':{zh:'现场监督',en:'Site Manager'},'作業員':{zh:'作业员',en:'Worker'},
    '外注':{zh:'外包',en:'Subcontractor'},'協力業者':{zh:'协作单位',en:'Partner'},
    '◂ メニュー':{zh:'◂ 菜单',en:'◂ Menu'},'◂ 戻る':{zh:'◂ 返回',en:'◂ Back'},
    'メニュー':{zh:'菜单',en:'Menu'},'戻る':{zh:'返回',en:'Back'},'出る':{zh:'退出',en:'Sign out'},
    '閉じる':{zh:'关闭',en:'Close'},'保存':{zh:'保存',en:'Save'},'保存する':{zh:'保存',en:'Save'},
    '登録':{zh:'登记',en:'Register'},'登録する':{zh:'登记',en:'Register'},
    '削除':{zh:'删除',en:'Delete'},'編集':{zh:'编辑',en:'Edit'},'追加':{zh:'添加',en:'Add'},
    'キャンセル':{zh:'取消',en:'Cancel'},'開く':{zh:'打开',en:'Open'},
    'すべて展開':{zh:'全部展开',en:'Expand all'},'すべて畳む':{zh:'全部折叠',en:'Collapse all'},
    '絞り込み':{zh:'筛选',en:'Filter'},'使い方':{zh:'使用方法',en:'Help'},
    '？使い方':{zh:'？使用方法',en:'? Help'},'？使い方 ▼':{zh:'？使用方法 ▼',en:'? Help ▼'},
    '取り込む':{zh:'导入',en:'Import'},'＋ 書類を取り込む':{zh:'＋ 导入文件',en:'+ Import file'},
    '見本':{zh:'示例',en:'Sample'},'付箋':{zh:'便签',en:'Notes'},'凡例':{zh:'图例',en:'Legend'},
    '見方':{zh:'查看方法',en:'Guide'},'全体':{zh:'全部',en:'Fit'},
    'ガント':{zh:'甘特图',en:'Gantt'},'ネットワーク':{zh:'网络图',en:'Network'},
    '改訂の履歴':{zh:'修订历史',en:'Revisions'},'工程表を改定する':{zh:'修订工程表',en:'Revise schedule'},
    '工程を追加する':{zh:'添加工序',en:'Add phase'},'＋工種':{zh:'＋工种',en:'+ Trade'},
    '＋ 工種を追加':{zh:'＋ 添加工种',en:'+ Add trade'},
    '基本':{zh:'基本',en:'Basics'},'現場管理':{zh:'现场管理',en:'Site Management'},
    '損益':{zh:'损益',en:'Profit & Loss'},'勤怠':{zh:'考勤',en:'Attendance'},
    '工事案件':{zh:'工程项目',en:'Projects'},'一覧・登録・編集':{zh:'列表・登记・编辑',en:'List / Register / Edit'},
    '設定':{zh:'设置',en:'Settings'},'権限マトリクス':{zh:'权限矩阵',en:'Permissions Matrix'},
    'ワークフロー図':{zh:'工作流程图',en:'Workflow'},'システム全体の流れ（最新版）':{zh:'系统整体流程（最新版）',en:'System overview (latest)'},
    '工程表':{zh:'工程表',en:'Schedule'},'ガント・ネットワーク':{zh:'甘特图・网络图',en:'Gantt / Network'},
    '材工':{zh:'材料与施工',en:'Materials & Labor'},'現場の記録':{zh:'现场记录',en:'Site Records'},
    '報・連・相':{zh:'报・联・商',en:'Report / Contact / Consult'},'書類':{zh:'文件',en:'Documents'},
    '打刻':{zh:'打卡',en:'Clock in/out'},'勤怠の確認':{zh:'考勤确认',en:'Attendance'},'準備中':{zh:'准备中',en:'Coming soon'},
    '見積':{zh:'报价',en:'Estimate'},'予算':{zh:'预算',en:'Budget'},'納期':{zh:'交期',en:'Delivery'},
    '日報':{zh:'日报',en:'Daily Report'},'写真・書類':{zh:'照片・文件',en:'Photos & Docs'},
    '安全書類':{zh:'安全文件',en:'Safety Docs'},'竣工図書':{zh:'竣工图书',en:'Handover Docs'},
    '出来高':{zh:'完成量',en:'Progress'},'設計変更':{zh:'设计变更',en:'Change Orders'},
    '取引先':{zh:'客户/供应商',en:'Partners'},'社員':{zh:'员工',en:'Staff'},'権限':{zh:'权限',en:'Permissions'},
    '未着手':{zh:'未开始',en:'Not started'},'着手中':{zh:'进行中',en:'In progress'},
    '完了':{zh:'完成',en:'Done'},'中断':{zh:'中断',en:'Paused'},'余裕なし':{zh:'无余裕',en:'No slack'},
    '材料':{zh:'材料',en:'Material'},'材料費':{zh:'材料费',en:'Material cost'},
    '外注・労務費':{zh:'外包・人工费',en:'Labor cost'},'最安':{zh:'最低价',en:'Lowest'},
    '区分':{zh:'类别',en:'Type'},'品名':{zh:'品名',en:'Item'},'数量':{zh:'数量',en:'Qty'},
    '単価':{zh:'单价',en:'Unit price'},'金額':{zh:'金额',en:'Amount'},'工程':{zh:'工序',en:'Phase'},
    '着工':{zh:'开工',en:'Start'},'進捗':{zh:'进度',en:'Progress'},'採用':{zh:'采用',en:'Adopt'},
    '日付':{zh:'日期',en:'Date'},'種別':{zh:'种类',en:'Type'},'件名':{zh:'标题',en:'Title'},
    '登録者':{zh:'登记人',en:'Registered by'},'操作':{zh:'操作',en:'Actions'},
    '納品予定日':{zh:'预计交货日',en:'Est. delivery'},'納品日':{zh:'交货日',en:'Delivered'},
    '発注日':{zh:'下单日',en:'Order date'},'リードタイム':{zh:'交货周期',en:'Lead time'},
    '発注状況':{zh:'下单状态',en:'Order status'},'未発注':{zh:'未下单',en:'Not ordered'},
    '発注済み':{zh:'已下单',en:'Ordered'},'納品済み':{zh:'已交货',en:'Delivered'},
    '業者見積・原価決定':{zh:'供应商报价・成本确定',en:'Vendor Estimates & Cost'},
    '出来高・進捗':{zh:'完成量・进度',en:'Progress'},'損益・粗利':{zh:'损益・毛利',en:'Profit & Margin'},
    '利用者':{zh:'用户',en:'Users'},'作業日報':{zh:'作业日报',en:'Daily Report'},
    '材工発注':{zh:'材料与施工下单',en:'Material & Labor Orders'},
    '材料到着スケジュール':{zh:'材料到货计划',en:'Material Delivery'},'実行予算':{zh:'执行预算',en:'Working Budget'},
    '保管書類':{zh:'存档文件',en:'Stored Docs'},'ひな型':{zh:'模板',en:'Templates'},
    'ログイン':{zh:'登录',en:'Sign in'},'メールアドレス':{zh:'邮箱地址',en:'Email'},
    'パスワード':{zh:'密码',en:'Password'},'ログインする':{zh:'登录',en:'Sign in'}
  };

  const lang = getLang();
  function tr(s){
    if (s == null) return null;
    const key = String(s).trim();
    if (!key) return null;
    const e = DICT[key];
    if (!e) return null;
    const v = e[lang];
    return (v && v !== key) ? v : null;
  }
  function translateNode(node){
    if (!node) return;
    if (node.nodeType === 3){
      const raw = node.nodeValue;
      const t = tr(raw);
      if (t !== null){
        const lead = (raw.match(/^\s*/)||[''])[0], trail = (raw.match(/\s*$/)||[''])[0];
        node.nodeValue = lead + t + trail;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || (node.classList && node.classList.contains('langsel'))) return;
    if (node.hasAttribute){
      ['placeholder','title'].forEach(a => {
        if (node.hasAttribute(a)){ const t = tr(node.getAttribute(a)); if (t !== null) node.setAttribute(a, t); }
      });
      if (tag === 'INPUT' && /^(button|submit|reset)$/i.test(node.getAttribute('type')||'')){
        const t = tr(node.value); if (t !== null) node.value = t;
      }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) translateNode(c);
  }
  function translateAll(){
    if (lang === 'ja') return;
    if (document.body) translateNode(document.body);
    const t = tr(document.title); if (t !== null) document.title = t;
  }
  function injectSwitcher(){
    const bar = document.querySelector('.bar');
    if (!bar || bar.querySelector('.langsel')) return;
    const sel = document.createElement('select');
    sel.className = 'langsel';
    sel.setAttribute('aria-label','Language');
    sel.style.cssText = 'width:auto;max-width:150px;min-width:0;min-height:28px;font-size:12.5px;font-weight:700;border-radius:6px;border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.16);color:#fff;padding:0 8px;margin-left:8px;flex:0 0 auto;cursor:pointer;';
    LANGS.forEach(function(pair){
      const o = document.createElement('option'); o.value = pair[0]; o.textContent = pair[1]; o.style.color = '#111';
      if (pair[0] === lang) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener('change', function(){ setLang(sel.value); location.reload(); });
    const who = bar.querySelector('.who');
    if (who) who.after(sel); else bar.appendChild(sel);
  }
  function boot(){
    try{ document.documentElement.lang = lang === 'zh' ? 'zh-CN' : (lang === 'en' ? 'en' : 'ja'); }catch(e){}
    injectSwitcher();
    translateAll();
    if (lang !== 'ja' && window.MutationObserver && document.body){
      const obs = new MutationObserver(function(muts){
        for (var i=0;i<muts.length;i++){ var an=muts[i].addedNodes; for (var j=0;j<an.length;j++){ try{ translateNode(an[j]); }catch(e){} } }
      });
      obs.observe(document.body, { childList:true, subtree:true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
