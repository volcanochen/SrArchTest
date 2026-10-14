/* 系统架构设计师备考助手 · Service Worker
 * 使 Chrome 满足「安装应用」条件，并支持离线访问。
 * 资源清单变更时请递增 CACHE 版本号。
 */
var CACHE = 'sa-exam-app-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/data.js',
  './js/question-bank.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS).then(function () {
        return self.skipWaiting();
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      })).then(function () {
        return self.clients.claim();
      });
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，失败时回退到缓存的入口页（离线可打开）。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // 静态资源：缓存优先，后台更新。
  event.respondWith(
    caches.match(request).then(function (cached) {
      var fetching = fetch(request).then(function (response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, clone); });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || fetching;
    })
  );
});
