import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";

// ── 프로덕션 시크릿 키 검증 ──────────────────────────────────────────────────
// 경고가 아니라 차단: 잘못된 키로 서버가 기동되면 실결제가 테스트 키로 처리될 수 있음
if (process.env["NODE_ENV"] === "production") {
  const tossKey = process.env["TOSS_SECRET_KEY"];
  if (!tossKey) {
    throw new Error(
      "[startup] TOSS_SECRET_KEY 미설정 — 프로덕션 서버 시작 불가. Replit Secrets에 live_sk_... 키를 등록하세요.",
    );
  }
  if (tossKey.startsWith("test_sk_")) {
    throw new Error(
      "[startup] TOSS_SECRET_KEY가 테스트 키(test_sk_)입니다 — 프로덕션에서 사용 불가. live_sk_... 키로 교체하세요.",
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
});
