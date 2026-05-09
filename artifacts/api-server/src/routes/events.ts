import { Router } from "express";
import { crawlAll, crawlUrl } from "../lib/crawler.js";
import {
  appendEvents,
  readEvents,
  saveEvents,
  saveEventDraft,
  updateEventStatus,
} from "../lib/storage.js";
import type { CrawledEvent, EventStatus } from "../lib/storage.js";
import { generateSocialDraft } from "../lib/draft.js";
import { parseDates, detectCategory } from "../lib/dateParser.js";
import crypto from "crypto";

const router = Router();

type EnrichedEvent = CrawledEvent;


function enrichEvent(event: CrawledEvent): EnrichedEvent {
  const category = event.category || detectCategory(event.title, event.description) || "지역소식";
  const { startDate, endDate, scheduleStatus } = event.startDate
    ? { startDate: event.startDate, endDate: event.endDate, scheduleStatus: event.scheduleStatus }
    : parseDates(event.date);
  return { ...event, category, startDate, endDate, scheduleStatus };
}

router.get("/events", async (req, res) => {
  try {
    const stored = await readEvents();
    const events = stored.map(enrichEvent);
    res.json({ success: true, total: events.length, events });
  } catch (err) {
    req.log.error({ err }, "이벤트 목록 조회 실패");
    res.status(500).json({ success: false, error: "이벤트 목록 조회 실패" });
  }
});

router.post("/crawl", async (req, res) => {
  let added = 0;
  let total = 0;
  try {
    req.log.info("전체 크롤링 시작 (POST /crawl)");
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const result = await appendEvents(allEvents);
    added = result.added;
    total = result.total;
    req.log.info({ added, total }, "전체 크롤링 완료");
  } catch (err) {
    req.log.warn({ err }, "크롤링 중 일부 오류 발생 (계속 진행)");
  }
  return res.json({ success: true, added, total, message: "크롤링 완료" });
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

    const dateStr = date || "";
    const { startDate, endDate, scheduleStatus } = parseDates(dateStr);
    const event: CrawledEvent = {
      id: crypto.createHash("md5").update(`manual:${title}:${Date.now()}`).digest("hex"),
      title,
      description: description || "",
      date: startDate || dateStr,
      startDate: startDate || dateStr,
      endDate,
      scheduleStatus,
      location: "강릉",
      category: detectCategory(title, description || ""),
      thumbnail: null,
      link: link || "",
      source: source || "수동 등록",
      sourceType: "manual",
      status: "draft",
      socialDraft: null,
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

    const allowed: EventStatus[] = ["draft", "approved", "rejected", "published"];
    if (!status || !allowed.includes(status as EventStatus)) {
      return res.status(400).json({
        success: false,
        error: "status는 draft | approved | rejected | published 중 하나여야 합니다.",
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

router.patch("/events/:id/draft", async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, hashtags } = req.body as { caption?: string; hashtags?: string[] };
    if (typeof caption !== "string") {
      return res.status(400).json({ success: false, error: "caption 필드가 필요합니다." });
    }
    const events = await readEvents();
    const event = events.find((e) => e.id === id);
    if (!event) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    if (!event.socialDraft) return res.status(400).json({ success: false, error: "초안이 없습니다. 먼저 초안을 생성하세요." });
    const updated = { ...event.socialDraft, caption: caption.trim(), hashtags: hashtags ?? event.socialDraft.hashtags };
    const saved = await saveEventDraft(id, updated);
    if (!saved) return res.status(500).json({ success: false, error: "초안 저장 실패" });
    req.log.info({ id }, "SNS 초안 수정");
    return res.json({ success: true, id, socialDraft: updated });
  } catch (err) {
    req.log.error({ err }, "SNS 초안 수정 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/regenerate-drafts", async (req, res) => {
  try {
    const siteUrl = process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app";
    const contentPattern = `${siteUrl}/content/`;

    const events = await readEvents();
    const targets = events.filter(
      (e) =>
        e.socialDraft &&
        (e.status === "approved" || e.status === "published") &&
        !e.socialDraft.caption.includes(contentPattern),
    );

    let regenerated = 0;
    for (const event of targets) {
      try {
        const approvedEvent = { ...event, status: "approved" as const };
        const newDraft = generateSocialDraft(approvedEvent);
        await saveEventDraft(event.id, newDraft);
        regenerated++;
      } catch (err) {
        req.log.warn({ id: event.id, err }, "초안 재생성 건너뜀");
      }
    }

    req.log.info({ total: targets.length, regenerated }, "SNS 초안 일괄 재생성 완료");
    return res.json({ success: true, total: targets.length, regenerated });
  } catch (err) {
    req.log.error({ err }, "SNS 초안 일괄 재생성 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.patch("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, thumbnail, location, category, startDate, endDate } = req.body as {
      title?: string;
      description?: string;
      thumbnail?: string | null;
      location?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
    };
    const patch: Partial<import("../lib/storage.js").CrawledEvent> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (thumbnail !== undefined) patch.thumbnail = thumbnail || null;
    if (location !== undefined) patch.location = location;
    if (category !== undefined) patch.category = category;
    if (startDate !== undefined) { patch.startDate = startDate; patch.date = startDate; }
    if (endDate !== undefined) patch.endDate = endDate;
    const updated = await import("../lib/storage.js").then((m) => m.updateEvent(id, patch));
    if (!updated) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    req.log.info({ id }, "이벤트 수정");
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "이벤트 수정 실패");
    return res.status(500).json({ success: false, error: "이벤트 수정 실패" });
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
