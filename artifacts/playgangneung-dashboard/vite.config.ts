import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// PORT/BASE_PATH: Replit 워크플로우에서 주입됨. VPS 빌드 시 기본값 사용.
const port = Number(process.env.PORT ?? "3000");
const basePath = process.env.BASE_PATH ?? "/";

const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),

    // ── PWA / Service Worker ─────────────────────────────────────────────────
    // registerType: 'autoUpdate'
    //   → 새 SW 설치 완료 시 즉시 skipWaiting + 모든 클라이언트 reload
    // injectRegister: 'auto'
    //   → 빌드 결과물 index.html에 registerSW.js 스크립트 자동 주입
    // manifest: false
    //   → public/manifest.json 그대로 사용 (중복 생성 방지)
    // devOptions.enabled: false
    //   → 개발 서버에서는 SW 비활성화 (HMR 간섭 방지)
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      devOptions: {
        enabled: false,
      },
      workbox: {
        // 새 SW 즉시 활성화 + 모든 탭 제어 인수
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,

        // 빌드 산출물 전체 precache (content-hash 기반 → 버전 자동 관리)
        globPatterns: [
          "**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff,woff2}",
        ],

        // SPA 클라이언트 라우팅 fallback
        navigateFallback: "index.html",
        // API 서버 경로는 SW가 가로채지 않도록 제외
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/content\//,
          /^\/about/,
          /^\/sitemap/,
        ],

        runtimeCaching: [
          // API 요청: 절대 캐시 안 함 (항상 최신 서버 데이터)
          {
            urlPattern: /\/api\//,
            handler: "NetworkOnly",
          },
          // SSR 콘텐츠 상세 페이지: 캐시 안 함
          {
            urlPattern: /\/content\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),

    // Replit 개발 환경 전용 플러그인
    ...(isDev && isReplit
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          clerk: ["@clerk/react"],
          query: ["@tanstack/react-query"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/pages/home.tsx",
      ],
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
