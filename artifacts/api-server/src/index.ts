import app from "./app";
import { logger } from "./lib/logger";
import { crawlAll } from "./lib/crawler";
import { appendEvents } from "./lib/storage";
import cron from "node-cron";

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

  // 매일 오전 9시 (한국 시간 KST) 자동 크롤링
  cron.schedule(
    "0 9 * * *",
    async () => {
      logger.info("자동 크롤링 시작 (오전 9시 스케줄)");
      try {
        const results = await crawlAll();
        const allEvents = results.flatMap((r) => r.events);
        const fresh = allEvents.filter((e) => e.scheduleStatus !== "ended");
        const { added, updated, total } = await appendEvents(fresh);
        logger.info({ added, updated, total }, "자동 크롤링 완료");
      } catch (err) {
        logger.error({ err }, "자동 크롤링 실패");
      }
    },
    { timezone: "Asia/Seoul" },
  );

  logger.info("자동 크롤링 스케줄 등록 완료 (매일 오전 9시 KST)");
});
