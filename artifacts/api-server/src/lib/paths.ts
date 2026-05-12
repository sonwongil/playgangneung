import path from "path";

// 프로덕션: esbuild 배너가 __dirname = dist/ 로 주입
// 개발: build 후 dist/에서 실행되므로 동일
// 어느 환경이든 artifact 루트 = dist/의 상위 디렉토리
const distDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(new URL(import.meta.url).pathname);

export const ARTIFACT_ROOT = path.resolve(distDir, "..");
export const DATA_DIR = path.join(ARTIFACT_ROOT, "data");
export const FONTS_DIR = path.join(ARTIFACT_ROOT, "fonts");
export const CARDS_DIR = path.join(ARTIFACT_ROOT, "public", "cards");
export const SESSIONS_DIR = path.join(ARTIFACT_ROOT, "data", "sessions");
