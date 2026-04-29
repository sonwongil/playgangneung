import { Router } from "express";
import { crawlAll, crawlUrl } from "../lib/crawler.js";
import { appendEvents, readEvents, saveEvents } from "../lib/storage.js";
import type { CrawledEvent } from "../lib/storage.js";
import crypto from "crypto";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const events = await readEvents();
    res.json({ success: true, total: events.length, events });
  } catch (err) {
    req.log.error({ err }, "이벤트 목록 조회 실패");
    res.status(500).json({ success: false, error: "이벤트 목록 조회 실패" });
  }
});

router.post("/events/crawl", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };

    if (url) {
      req.log.info({ url }, "커스텀 URL 크롤링 시작");
      const events = await crawlUrl(url);
      const { added, total } = await appendEvents(events);
      req.log.info({ added, total }, "커스텀 URL 크롤링 완료");
      return res.json({
        success: true,
        added,
        total,
        summary: [{ source: url, collected: events.length }],
      });
    }

    req.log.info("전체 크롤링 시작");
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const { added, total } = await appendEvents(allEvents);

    const summary = results.map((r) => ({
      source: r.source,
      collected: r.events.length,
      error: r.error,
    }));

    req.log.info({ added, total }, "크롤링 완료");
    return res.json({ success: true, added, total, summary });
  } catch (err) {
    req.log.error({ err }, "크롤링 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/manual", async (req, res) => {
  try {
    const { title, description, date, link, source } = req.body as {
      title?: string;
      description?: string;
      date?: string;
      link?: string;
      source?: string;
    };

    if (!title) {
      return res.status(400).json({ success: false, error: "제목은 필수입니다." });
    }

    const event: CrawledEvent = {
      id: crypto.createHash("md5").update(`manual:${title}:${Date.now()}`).digest("hex"),
      title,
      description: description || "",
      date: date || "",
      link: link || "",
      source: source || "수동 등록",
      crawledAt: new Date().toISOString(),
    };

    const { added, total } = await appendEvents([event]);
    return res.json({ success: true, added, total });
  } catch (err) {
    req.log.error({ err }, "수동 등록 실패");
    return res.status(500).json({ success: false, error: "수동 등록 실패" });
  }
});

router.delete("/events", async (req, res) => {
  try {
    await saveEvents([]);
    res.json({ success: true, message: "전체 데이터 초기화 완료" });
  } catch (err) {
    req.log.error({ err }, "데이터 초기화 실패");
    res.status(500).json({ success: false, error: "초기화 실패" });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const events = await readEvents();
    const filtered = events.filter((e) => e.id !== id);
    await saveEvents(filtered);
    res.json({ success: true, removed: events.length - filtered.length });
  } catch (err) {
    req.log.error({ err }, "삭제 실패");
    res.status(500).json({ success: false, error: "삭제 실패" });
  }
});

export default router;
