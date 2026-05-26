import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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
