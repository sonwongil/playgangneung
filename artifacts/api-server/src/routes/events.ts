import { Router } from "express";
import { crawlAll, crawlUrl } from "../lib/crawler.js";
import {
  appendEvents,
  readEvents,
  saveEvents,
  saveEventCard,
  saveEventDraft,
  updateEventStatus,
} from "../lib/storage.js";
import type { CrawledEvent, EventStatus } from "../lib/storage.js";
import { generateSocialDraft } from "../lib/draft.js";
import { generateCardImage } from "../lib/card.js";
import crypto from "crypto";

const router = Router();

const CATEGORY_THUMBNAILS: Record<string, string> = {
  행사: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  맛집: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
  핫플: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  지역소식: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
};
const DEFAULT_THUMBNAIL = "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80";
const DEFAULT_CATEGORY = "지역소식";

function enrichEvent(event: CrawledEvent & { category?: string; thumbnail?: string }) {
  const category = event.category ?? DEFAULT_CATEGORY;
  return {
    ...event,
    category,
    thumbnail: event.thumbnail ?? CATEGORY_THUMBNAILS[category] ?? DEFAULT_THUMBNAIL,
  };
}

router.get("/events", async (req, res) => {
  try {
    const events = await readEvents();
    const enriched = events.map(enrichEvent);
    res.json({ success: true, total: enriched.length, events: enriched });
  } catch (err) {
    req.log.error({ err }, "이벤트 목록 조회 실패");
    res.status(500).json({ success: false, error: "이벤트 목록 조회 실패" });
  }
});

router.post("/crawl", async (req, res) => {
  try {
    req.log.info("전체 크롤링 시작 (POST /crawl)");
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const { added, total } = await appendEvents(allEvents);
    req.log.info({ added, total }, "전체 크롤링 완료");
    return res.json({ success: true, added, total, message: "크롤링 완료" });
  } catch (err) {
    req.log.error({ err }, "크롤링 실패");
    return res.status(500).json({ success: false, error: String(err) });
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
        summary: [
          {
            source: url,
            sourceType: events[0]?.sourceType ?? "html",
            collected: events.length,
          },
        ],
      });
    }

    req.log.info("전체 크롤링 시작 (RSS → HTML)");
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const { added, total } = await appendEvents(allEvents);

    const summary = results.map((r) => ({
      source: r.source,
      sourceType: r.sourceType,
      collected: r.events.length,
      error: r.error,
    }));

    req.log.info({ added, total }, "전체 크롤링 완료");
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
      sourceType: "manual",
      status: "draft",
      socialDraft: null,
      cardImageUrl: null,
      crawledAt: new Date().toISOString(),
    };

    const { added, total } = await appendEvents([event]);
    return res.json({ success: true, added, total });
  } catch (err) {
    req.log.error({ err }, "수동 등록 실패");
    return res.status(500).json({ success: false, error: "수동 등록 실패" });
  }
});

router.patch("/events/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    const allowed: EventStatus[] = ["draft", "approved", "rejected"];
    if (!status || !allowed.includes(status as EventStatus)) {
      return res.status(400).json({
        success: false,
        error: "status는 draft | approved | rejected 중 하나여야 합니다.",
      });
    }

    const updated = await updateEventStatus(id, status as EventStatus);
    if (!updated) {
      return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    }

    req.log.info({ id, status }, "이벤트 상태 변경");
    return res.json({ success: true, id, status });
  } catch (err) {
    req.log.error({ err }, "상태 변경 실패");
    return res.status(500).json({ success: false, error: "상태 변경 실패" });
  }
});

router.post("/events/:id/draft", async (req, res) => {
  try {
    const { id } = req.params;
    const events = await readEvents();
    const event = events.find((e) => e.id === id);

    if (!event) {
      return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    }
    if (event.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: "승인(approved) 상태의 이벤트만 SNS 초안을 생성할 수 있습니다.",
      });
    }

    const socialDraft = generateSocialDraft(event);
    const saved = await saveEventDraft(id, socialDraft);
    if (!saved) {
      return res.status(500).json({ success: false, error: "초안 저장 실패" });
    }

    req.log.info({ id }, "SNS 초안 생성 완료");
    return res.json({ success: true, id, socialDraft });
  } catch (err) {
    req.log.error({ err }, "SNS 초안 생성 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/:id/card", async (req, res) => {
  try {
    const { id } = req.params;
    const events = await readEvents();
    const event = events.find((e) => e.id === id);

    if (!event) {
      return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    }
    if (event.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: "approved 상태의 이벤트만 카드를 생성할 수 있습니다.",
      });
    }
    if (!event.socialDraft) {
      return res.status(400).json({
        success: false,
        error: "SNS 초안이 먼저 생성되어야 합니다.",
      });
    }

    const cardImageUrl = await generateCardImage(event);
    const saved = await saveEventCard(id, cardImageUrl);
    if (!saved) {
      return res.status(500).json({ success: false, error: "카드 정보 저장 실패" });
    }

    req.log.info({ id, cardImageUrl }, "카드 이미지 생성 완료");
    return res.json({ success: true, id, cardImageUrl });
  } catch (err) {
    req.log.error({ err }, "카드 이미지 생성 실패");
    return res.status(500).json({ success: false, error: String(err) });
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
