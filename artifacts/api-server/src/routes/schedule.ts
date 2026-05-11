import { Router } from "express";
import { readScheduleConfig, reschedule } from "../lib/scheduler.js";

const router = Router();

router.get("/schedule", async (_req, res) => {
  const cfg = await readScheduleConfig();
  res.json(cfg);
});

router.post("/schedule", async (req, res) => {
  if (!req.session.isAdmin) {
    res.status(401).json({ success: false, error: "로그인이 필요합니다" });
    return;
  }
  const { crawlHour, crawlMinute } = req.body as { crawlHour?: unknown; crawlMinute?: unknown };
  const h = Number(crawlHour);
  const m = Number(crawlMinute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) {
    res.status(400).json({ success: false, error: "유효하지 않은 시간 (시: 0-23, 분: 0-59)" });
    return;
  }
  await reschedule(h, m);
  res.json({ success: true, crawlHour: h, crawlMinute: m });
});

export default router;
