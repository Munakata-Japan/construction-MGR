/* ============================================================
   宗像総合管理システム  Service Worker（ネットワーク優先）
   BUILD: sw v20260904A
   ------------------------------------------------------------
   目的: GitHub Pages はHTMLに「キャッシュしない」HTTPヘッダーを
   付けられず、変更後に毎回ハード再読み込みが必要だった。
   このSWは「オンライン時は必ずネットワークから最新を取得」する
   ネットワーク優先方式。取得できたものは控えとしてキャッシュし、
   ネットワーク不通のときだけキャッシュを返す（オフライン保険）。
   → 通常のリロードで最新が反映され、ハード再読み込みが不要になる。
   ------------------------------------------------------------
   ※ 万一この仕組みを止めたいときは、この sw.js の中身を
      「登録解除」版に差し替えてデプロイすれば無効化できる（下部参照）。
   ============================================================ */
const CACHE = 'munakata-mgr-v1';

// --- 停止用スイッチ：true にして差し替えると、SWを解除して素の状態に戻す ---
const KILL = false;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    if (KILL){
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.navigate(c.url));
      return;
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (KILL) return;                       // 停止時は素通し
  const req = e.request;
  if (req.method !== 'GET') return;       // 参照系だけ扱う
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // Supabaseや外部CDNは素通し
  if (url.pathname.endsWith('/sw.js')) return;      // SW自身はブラウザ管理に任せる

  e.respondWith((async () => {
    try {
      // まずネットワーク（＝常に最新）
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic'){
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());    // オフライン用の控え
      }
      return fresh;
    } catch (err) {
      // 不通のときだけ控えを返す
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
