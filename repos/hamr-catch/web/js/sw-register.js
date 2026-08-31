// ============================================================
// sw-register.js - Service Worker 注册（PWA 离线支持）
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker 已注册:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 注册失败:', err);
      });
  });
}