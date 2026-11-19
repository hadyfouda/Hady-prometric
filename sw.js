// Hady Prometric service worker: offline cache + decrypts the encrypted app files with the key saved at unlock.
const VERSION = '1b33c30805eb';
const FILES = ["assets/Antibiotics_1-DG4-g_t5.js", "assets/Antibiotics_2-D10wr-7t.js", "assets/Antibiotics_3-D2azNQo9.js", "assets/Antibiotics_4-DjNLz_ga.js", "assets/Anticoagulant-Asthma-Herbal-BlWSnXOd.js", "assets/CNS_1-B5PuDiYG.js", "assets/CNS_2-D-Pw5HS7.js", "assets/CNS_3-CgaRBQ4k.js", "assets/CNS_4-C0Nr_Vjk.js", "assets/CNS_5-D056l6sM.js", "assets/Calculations_1-Bk8VlM2_.js", "assets/Calculations_2-B9aifAtk.js", "assets/Calculations_3-5SkLfaEF.js", "assets/Calculations_4-Bxtg2Ycx.js", "assets/Diabetes_1-DrmEsYnC.js", "assets/Diabetes_2-CEAjxrbI.js", "assets/Diabetes_3-CzOqgXkD.js", "assets/Dyslipidemia_1-D3SgDdMU.js", "assets/Dyslipidemia_2-B_i7grcl.js", "assets/Error_1-CSnSHmDe.js", "assets/Error_2-IeBnrFOm.js", "assets/Error_3-CtfhBsqo.js", "assets/Error_4-B7lVxBkP.js", "assets/Ethics_1-DbNvs97E.js", "assets/Ethics_2-Bs_hBpC3.js", "assets/Extras-CQjyh0eK.js", "assets/Genomic_1-B0e0uzjr.js", "assets/Genomic_2-B4g902bI.js", "assets/HTN_1-cbd2ju_y.js", "assets/HTN_2-C17cFMei.js", "assets/HTN_3-CBSee014.js", "assets/HTN_4-D6kGZeSf.js", "assets/HTN_5-D0sRkoGp.js", "assets/Immunity_1-CFpM9m6w.js", "assets/Immunity_2-DYkVVug1.js", "assets/Immunity_3-Dhf0UoPo.js", "assets/Immunity_4-t3hWnVik.js", "assets/Immunity_5-DAf5HHTd.js", "assets/Regulation-1-EJUwR_.js", "assets/Vaccine_1-BAZPOuba.js", "assets/Vaccine_2-C0K-m6tI.js", "assets/index-C0RzOpzd.js", "assets/index-Cku0CKmj.css"];
const CACHE = 'hp-' + VERSION;
const FONT_CACHE = 'hp-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './salt.json'];
const TYPES = { js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', woff2: 'font/woff2' };

const idbKey = () => new Promise((ok) => {
  const r = indexedDB.open('hady-pwa', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { const t = r.result.transaction('kv', 'readonly').objectStore('kv').get('key'); t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); };
  r.onerror = () => ok(null);
});

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([...SHELL, ...['app.html', ...FILES].map((f) => './enc/' + f + '.enc')])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('hp-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const scopePath = new URL(self.registration.scope).pathname;

async function decrypted(rel) {
  const key = await idbKey();
  if (!key) return rel === 'app.html' ? Response.redirect(self.registration.scope, 302) : new Response('locked', { status: 403 });
  const url = './enc/' + rel + '.enc';
  let res = await caches.match(url, { cacheName: CACHE });
  if (!res) { res = await fetch(url); if (!res.ok) return new Response('not found', { status: 404 }); }
  const buf = new Uint8Array(await res.arrayBuffer());
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    const ext = rel.split('.').pop();
    return new Response(plain, { headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream' } });
  } catch {
    return rel === 'app.html' ? Response.redirect(self.registration.scope, 302) : new Response('bad key', { status: 403 });
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin && url.pathname.startsWith(scopePath)) {
    const rel = url.pathname.slice(scopePath.length);
    if (rel === 'app.html' || (rel.startsWith('assets/') && FILES.includes(rel))) { e.respondWith(decrypted(rel)); return; }
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
    return;
  }
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r;
    }));
  }
});
