/* ============================================================
   建設統合管理システム  共通処理
   BUILD: common.js v20260723D
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
    .select('id, name, role, organization_id, employee_type')
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
  if (/^(index|mode-select)\.html$/.test(here)) return;

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
