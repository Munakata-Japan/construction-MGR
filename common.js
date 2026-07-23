/* ============================================================
   建設統合管理システム  共通処理
   BUILD: common.js v20260724A
   ============================================================ */

const STATUS = {
  estimate : '見積',
  ordered  : '受注',
  started  : '着工',
  completed: '完工',
  invoiced : '請求済',
  paid     : '入金済',
  cancelled: '中止'
};

const ROLE_LABEL = { admin:'経営者', manager:'現場監督', member:'作業員' };

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
  if (text) el.scrollIntoView({ block:'nearest' });
}

/* ---------- ログイン確認 ----------
   ログインしていなければログイン画面へ戻す。
   戻り値: { session, me }  me は app_users の1行
------------------------------------ */
async function requireAuth(){
  const { data:{ session } } = await sb.auth.getSession();
  if (!session){
    location.replace('index.html');
    return null;
  }

  const { data:me, error } = await sb
    .from('app_users')
    .select('id, name, role, organization_id, employee_type, department')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error){
    alert('利用者情報を読み込めませんでした。\n' + error.message);
    return null;
  }
  if (!me){
    alert('このアカウントはまだ会社に登録されていません。\n管理者に利用者の追加を依頼してください。');
    await sb.auth.signOut();
    location.replace('index.html');
    return null;
  }
  return { session, me };
}

/* ---------- 見出し帯に利用者を表示 ---------- */
function paintBar(me, orgName){
  const who = document.getElementById('who');
  if (!who) return;
  who.innerHTML = `<b>${esc(me.name)}</b>${esc(orgName || '')} ／ ${esc(ROLE_LABEL[me.role] || me.role)}`;
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
  if (/^(index|mode-select|report-entry)\.html$/.test(here)) return;

  function put(){
    const bar = document.querySelector('.bar');
    if (!bar) return;
    if (bar.querySelector('.backbtn')) return;

    const a = document.createElement('a');
    a.className = 'btn ghost sm barbtn backbtn';
    a.href = 'mode-select.html';
    a.textContent = '◂ メニュー';

    const mark = bar.querySelector('.mark');
    if (mark) mark.after(a); else bar.prepend(a);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', put);
  } else {
    put();
  }
})();
