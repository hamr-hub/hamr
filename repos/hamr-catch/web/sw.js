// hamr-catch Service Worker
// 缓存静态资源，让 PWA 离线可启动

const CACHE_NAME = 'hamr-catch-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/db.js',
  '/js/camera.js',
  '/js/qr.js',
  '/js/p2p.js',
  '/js/sync.js',
  '/js/app.js',
  '/js/sw-register.js',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] 部分静态资源缓存失败（首次安装可能正常）:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // 仅处理同源 GET 请求
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 网络优先 + 缓存回退
  event.respondWith(
    fetch(request)
      .then((resp) => {
        // 成功则缓存
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return resp;
      })
      .catch(() => {
        // 网络失败，从缓存读取
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // SPA fallback
          if (request.mode === 'navigate') return caches.match('/index.html');
          return new Response('Offline', { status: 503 });
        });
      })
  );
});