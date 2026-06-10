import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { loadMetaTokenFromDb } from "./lib/metaApi.js";
import { resetPasswordFromEnv } from "./lib/auth.js";

// ── 프로덕션 시크릿 키 검증 ──────────────────────────────────────────────────
// ENABLE_TOSS_PAYMENT=true 일 때만 검증 — 계좌이체 전용 운영 시 서버 시작 차단 없음
if (process.env["NODE_ENV"] === "production" && process.env["ENABLE_TOSS_PAYMENT"] === "true") {
  const tossKey = process.env["TOSS_SECRET_KEY"];
  if (!tossKey) {
    throw new Error(
      "[startup] ENABLE_TOSS_PAYMENT=true 이지만 TOSS_SECRET_KEY 미설정 — Replit Secrets에 live_sk_... 키를 등록하세요.",
    );
  }
  if (tossKey.startsWith("test_sk_")) {
    throw new Error(
      "[startup] TOSS_SECRET_KEY가 테스트 키(test_sk_)입니다 — live_sk_... 키로 교체하세요.",
    );
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  void loadMetaTokenFromDb();
  void resetPasswordFromEnv();
});
