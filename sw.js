// PWA Service Worker 離線快取引擎
// 這支程式會在背景攔截所有的網路請求，並將 Tailwind CSS 與圖示等資源動態存入手機

const CACHE_NAME = 'money-app-cache-v1';

// 當 Service Worker 被安裝時
self.addEventListener('install', event => {
    // 強制立即生效，不需等待舊版網頁關閉
    self.skipWaiting();
    
    // 預先快取核心首頁檔案
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                './',
                './index.html'
            ]);
        })
    );
});

// 當 Service Worker 正式啟動時
self.addEventListener('activate', event => {
    // 接管所有頁面控制權
    event.waitUntil(clients.claim());
});

// 攔截所有網路請求 (動態快取機制)
self.addEventListener('fetch', event => {
    // 只攔截 GET 請求
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 1. 如果手機快取裡已經有這個檔案 (例如圖示或 CSS)，就直接離線給予，不耗費網路
            if (cachedResponse) {
                return cachedResponse;
            }

            // 2. 如果快取沒有，才真的連上網路去抓
            return fetch(event.request).then(networkResponse => {
                // 確認網路回應是正常的 (status 200)，且不是擴充套件的奇怪請求
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                // 3. 把剛從網路抓下來的檔案「偷偷複製一份」存進手機快取，下次離線就能用了！
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // 如果連網路都斷了，且快取也沒有，就在這裡安靜失敗，不讓網頁崩潰
            });
        })
    );
});
