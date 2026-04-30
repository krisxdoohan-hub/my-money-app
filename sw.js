// PWA Service Worker 離線快取引擎 (企業級快取優先策略)

// ==========================================
// ⚠️ 未來更新請注意：
// 當您修改了主程式 (index.html) 時，請務必將下方的 v1.1.0 往上加 (例如改為 v1.2.0)
// 只要這個名稱改變，手機就會立刻知道有新版本，並強制下載最新畫面！
// ==========================================
const CACHE_NAME = 'money-app-cache-v3.2.0'; 

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json' // 將 PWA 身分證也加入離線保護
];

// 安裝階段：預先載入核心骨架
self.addEventListener('install', event => {
    self.skipWaiting(); // 強制立即接管，不等舊版關閉
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// 啟動階段：清除舊版垃圾快取，確保手機容量乾淨
self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // 立即控制所有開啟的網頁
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // 如果快取名稱跟現在的版本不一樣，而且是我們記帳本的快取，就刪除它
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('money-app-cache')) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 攔截網路請求：採用 Cache First (快取優先) 結合背景默默更新機制
self.addEventListener('fetch', event => {
    // 忽略非 GET 請求
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            
            // 策略 1：如果手機裡已經有快取，【立刻】回傳給畫面，達成 0.1 秒斷網秒開
            if (cachedResponse) {
                
                // 【幕後動作】：即便秒開了，依然在背景偷偷去網路上抓最新版，並更新進手機
                fetch(event.request).then(networkResponse => {
                    // 放行 status === 0 (Opaque Response)，確保 Tailwind CSS 與外部圖示都能被快取
                    if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {
                    // 沒網路時背景更新失敗，安靜忽略，不影響使用者
                });

                return cachedResponse; 
            }

            // 策略 2：如果快取沒有 (例如第一次開啟)，才真的去網路上抓
            return fetch(event.request).then(networkResponse => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // 策略 3：終極防線。如果斷網，且剛好沒快取到，強制回傳首頁，防止白畫面崩潰
                if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
