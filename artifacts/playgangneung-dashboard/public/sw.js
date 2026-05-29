// 이 파일은 개발 서버(Vite dev)에서만 사용되는 플레이스홀더입니다.
// 프로덕션 빌드(vite build) 시 vite-plugin-pwa + Workbox가 이 파일을
// content-hash 기반 precache manifest를 포함한 완전한 SW로 교체합니다.
//
// 정책:
//   - skipWaiting: 새 SW 즉시 활성화
//   - clientsClaim: 모든 탭 제어 인수
//   - cleanupOutdatedCaches: 구버전 캐시 자동 삭제
//   - precache: JS/CSS/HTML을 content-hash 기반으로 캐시
//   - navigateFallback: SPA 라우팅 지원
//   - NetworkOnly: /api/, /content/ 경로는 캐시 안 함

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (e) => e.respondWith(fetch(e.request)));
