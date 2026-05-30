import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { sendMail, isMailConfigured } from "../lib/mailer.js";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { crawlAll, crawlUrl } from "../lib/crawler.js";
import { fetchYoutubeInfo } from "../lib/youtube.js";
import {
  appendEvents,
  deduplicateExisting,
  readEvents,
  saveEvents,
  saveEventDraft,
  updateEventStatus,
  updateEvent,
} from "../lib/storage.js";
import type { CrawledEvent, EventStatus } from "../lib/storage.js";
import { generateSocialDraft } from "../lib/draft.js";
import { generateCardImage } from "../lib/card.js";
import { parseDates, detectCategory } from "../lib/dateParser.js";
import { UPLOADS_DIR } from "../lib/paths.js";
import crypto from "crypto";

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
});

const router = Router();

router.use((req, res, next) => {
  // path 조건 추가: /events 경로에만 적용 (다른 라우터 요청이 통과하도록)
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method) && req.path.startsWith("/events")) {
    return requireAdmin(req, res, next);
  }
  next();
});

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

router.post("/events/crawl", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };

    if (url) {
      req.log.info({ url }, "커스텀 URL 크롤링 시작");
      const events = await crawlUrl(url);
      const fresh = events.filter((e) => e.scheduleStatus !== "ended");
      const { added, updated, total } = await appendEvents(fresh);
      req.log.info({ added, updated, total, skipped: events.length - fresh.length }, "커스텀 URL 크롤링 완료");
      return res.json({
        success: true,
        added,
        updated,
        total,
        summary: [
          {
            source: url,
            sourceType: events[0]?.sourceType ?? "html",
            collected: fresh.length,
            skippedEnded: events.length - fresh.length,
          },
        ],
      });
    }

    req.log.info("전체 크롤링 시작 (RSS → HTML)");
    const results = await crawlAll();
    const allEvents = results.flatMap((r) => r.events);
    const fresh = allEvents.filter((e) => e.scheduleStatus !== "ended");
    req.log.info({ collected: allEvents.length, skippedEnded: allEvents.length - fresh.length }, "종료된 행사 제외");
    const { added, updated, total } = await appendEvents(fresh);

    // 크롤링 후 기존 중복 소급 정리 (내용 충실도 기준)
    const dedup = await deduplicateExisting();
    req.log.info(dedup, "중복 소급 정리 완료");

    const summary = results.map((r) => ({
      source: r.source,
      sourceType: r.sourceType,
      collected: r.events.length,
      error: r.error,
    }));

    req.log.info({ added, updated, removed: dedup.removed, total: dedup.after }, "전체 크롤링 완료");
    return res.json({ success: true, added, updated, removed: dedup.removed, total: dedup.after, summary });
  } catch (err) {
    req.log.error({ err }, "크롤링 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/extract-url", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: "url 필드가 필요합니다." });

  try {
    // ── YouTube URL은 Data API로 직접 조회 ──────────────────────────────────
    const isYoutube = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\//i.test(url);
    if (isYoutube) {
      const info = await fetchYoutubeInfo(url);
      if (info) {
        return res.json({
          title: info.title,
          description: info.description,
          thumbnail: info.thumbnailUrl,
          startDate: "",
          endDate: "",
          location: "",
          link: url,
          videoUrl: url,
        });
      }
      // API 키 없거나 조회 실패 시 아래 HTML 스크래핑으로 폴백
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlayGangneungBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(400).json({ error: `페이지를 불러올 수 없습니다. (HTTP ${response.status})` });

    const html = await response.text();
    const $ = cheerio.load(html);

    const og = (prop: string) =>
      $(`meta[property="og:${prop}"]`).attr("content")?.trim() ||
      $(`meta[name="og:${prop}"]`).attr("content")?.trim() || "";

    const decodeEntities = (s: string) =>
      $("<span>").html(s).text();

    const title = decodeEntities(
      og("title") ||
      $("title").text().trim() ||
      $("h1").first().text().trim()
    );

    const description = decodeEntities(
      og("description") ||
      $('meta[name="description"]').attr("content")?.trim() ||
      $("p").first().text().trim().slice(0, 300)
    );

    const thumbnail = og("image") || "";

    // 날짜 패턴 추출 (YYYY.MM.DD, YYYY-MM-DD, YYYY년 MM월 DD일 등)
    const bodyText = $("body").text();
    const datePatterns = [
      /(\d{4})[.\-년](\d{1,2})[.\-월](\d{1,2})/g,
    ];
    const dates: string[] = [];
    for (const pat of datePatterns) {
      let m: RegExpExecArray | null;
      while ((m = pat.exec(bodyText)) !== null && dates.length < 4) {
        const d = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
        if (!dates.includes(d)) dates.push(d);
      }
    }

    // 장소 추출 (강릉 주변 키워드)
    const locationMatch = bodyText.match(/강릉\s*[\w\s가-힣]{0,20}(?:광장|공원|센터|홀|관|체육관|경기장|시장|거리|해변|해수욕장|호수|역)/);
    const location = locationMatch?.[0]?.trim() || "";

    req.log.info({ url, title }, "URL 자동 추출 완료");
    return res.json({
      title,
      description,
      thumbnail,
      startDate: dates[0] || "",
      endDate: dates[1] || "",
      location,
      link: url,
    });
  } catch (err: any) {
    req.log.warn({ url, err: err?.message }, "URL 추출 실패");
    return res.status(400).json({ error: `URL을 읽을 수 없습니다: ${err?.message ?? "알 수 없는 오류"}` });
  }
});

router.post("/events/manual", async (req, res) => {
  try {
    const { title, description, link, source, contact, category, startDate: rawStart, endDate: rawEnd, location, thumbnail, videoUrl } = req.body as {
      title?: string;
      description?: string;
      link?: string;
      source?: string;
      contact?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      location?: string;
      thumbnail?: string | null;
      videoUrl?: string | null;
    };

    if (!title) {
      return res.status(400).json({ success: false, error: "제목은 필수입니다." });
    }

    const dateStr = rawStart || "";
    const { startDate, endDate, scheduleStatus } = parseDates(`${rawStart || ""}${rawEnd ? `~${rawEnd}` : ""}`);
    const eventId = crypto.createHash("md5").update(`manual:${title}:${Date.now()}`).digest("hex");
    const siteUrl = process.env["SITE_URL"] ?? "https://playgangneung.com";
    const event: CrawledEvent = {
      id: eventId,
      title,
      description: description || "",
      date: startDate || dateStr,
      startDate: startDate || dateStr,
      endDate: endDate || rawEnd || "",
      scheduleStatus,
      location: location || "강릉",
      category: category || detectCategory(title, description || ""),
      thumbnail: thumbnail || null,
      extraImages: null,
      videoUrl: videoUrl || null,
      link: link || `${siteUrl}/content/${eventId}`,
      source: source || "PLAY강릉",
      contact: contact || "",
      sourceType: "manual",
      status: "approved",
      socialDraft: null,
      hashtags: null,
      crawledAt: new Date().toISOString(),
    };

    const { added, updated, total } = await appendEvents([event]);
    return res.json({ success: true, added, updated, total });
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

    const ok = await updateEventStatus(id, status as EventStatus);
    if (!ok) {
      return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    }

    req.log.info({ id, status }, "이벤트 상태 변경");

    if (status === "approved") {
      const log = req.log;
      setImmediate(async () => {
        try {
          const events = await readEvents();
          const ev = events.find((e) => e.id === id);
          if (!ev) return;
          if (!ev.socialDraft) {
            const draft = generateSocialDraft(ev);
            await saveEventDraft(ev.id, draft);
          }
          const allImages = [ev.thumbnail, ...(ev.extraImages ?? [])].filter(Boolean) as string[];
          const base = { id: ev.id, title: ev.title, description: ev.description, category: ev.category, source: ev.source, startDate: ev.startDate, date: ev.date };
          if (allImages.length === 0) {
            await generateCardImage({ ...base, thumbnail: undefined });
          } else {
            for (let i = 0; i < allImages.length; i++) {
              await generateCardImage({ ...base, thumbnail: allImages[i], suffix: i === 0 ? "thumb" : `extra${i}` });
            }
          }
          log.info({ id }, "자동 카드이미지 생성 완료");
        } catch (autoErr) {
          log.warn({ id, err: autoErr }, "자동 카드이미지 생성 실패");
        }
      });
    }

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

router.post("/events/:id/card", async (req, res) => {
  try {
    const { id } = req.params;
    const events = await readEvents();
    const event = events.find((e) => e.id === id);
    if (!event) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    const allImages: (string | null | undefined)[] = [event.thumbnail, ...(event.extraImages ?? [])];
    const validImages = allImages.filter(Boolean) as string[];
    const base = { id: event.id, title: event.title, description: event.description, category: event.category, source: event.source, startDate: event.startDate, date: event.date };
    const cardUrls: string[] = [];
    if (validImages.length === 0) {
      cardUrls.push(await generateCardImage({ ...base, thumbnail: undefined }));
    } else {
      for (let i = 0; i < validImages.length; i++) {
        cardUrls.push(await generateCardImage({ ...base, thumbnail: validImages[i], suffix: i === 0 ? "thumb" : `extra${i}` }));
      }
    }
    req.log.info({ id, count: cardUrls.length }, "카드이미지 생성 완료");
    return res.json({ success: true, id, cardUrls });
  } catch (err) {
    req.log.error({ err }, "카드이미지 생성 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/generate-cards-batch", async (req, res) => {
  try {
    const events = await readEvents();
    const targets = events.filter((e) => e.status === "approved" || e.status === "published");

    let generated = 0;
    let skipped = 0;
    for (const event of targets) {
      try {
        if (!event.socialDraft) {
          const draft = generateSocialDraft(event);
          await saveEventDraft(event.id, draft);
        }
        const allImages = [event.thumbnail, ...(event.extraImages ?? [])].filter(Boolean) as string[];
        const base = { id: event.id, title: event.title, description: event.description, category: event.category, source: event.source, startDate: event.startDate, date: event.date };
        if (allImages.length === 0) {
          await generateCardImage({ ...base, thumbnail: undefined });
        } else {
          for (let i = 0; i < allImages.length; i++) {
            await generateCardImage({ ...base, thumbnail: allImages[i], suffix: i === 0 ? "thumb" : `extra${i}` });
          }
        }
        generated++;
      } catch (err) {
        req.log.warn({ id: event.id, err }, "카드이미지 생성 건너뜀");
        skipped++;
      }
    }

    req.log.info({ total: targets.length, generated, skipped }, "카드이미지 일괄 생성 완료");
    return res.json({ success: true, total: targets.length, generated, skipped });
  } catch (err) {
    req.log.error({ err }, "카드이미지 일괄 생성 실패");
    return res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/events/regenerate-drafts", async (req, res) => {
  try {
    const siteUrl = process.env["SITE_URL"] ?? "https://playgangneung.com";
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
    const { title, description, thumbnail, videoUrl, location, category, startDate, endDate, contact } = req.body as {
      title?: string;
      description?: string;
      thumbnail?: string | null;
      videoUrl?: string | null;
      location?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      contact?: string;
    };
    const patch: Partial<import("../lib/storage.js").CrawledEvent> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (thumbnail !== undefined) patch.thumbnail = thumbnail || null;
    if (videoUrl !== undefined) patch.videoUrl = videoUrl || null;
    if (location !== undefined) patch.location = location;
    if (category !== undefined) patch.category = category;
    if (startDate !== undefined) { patch.startDate = startDate; patch.date = startDate; }
    if (endDate !== undefined) patch.endDate = endDate;
    if (contact !== undefined) patch.contact = contact;
    const updated = await import("../lib/storage.js").then((m) => m.updateEvent(id, patch));
    if (!updated) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
    req.log.info({ id }, "이벤트 수정");
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "이벤트 수정 실패");
    return res.status(500).json({ success: false, error: "이벤트 수정 실패" });
  }
});

router.post("/events/:id/upload-image", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err instanceof Error ? err.message : "업로드 실패" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "파일이 없습니다." });
    }
    const { id } = req.params;
    const slot = Number(req.query["slot"] ?? "0");
    const imageUrl = `/api/uploads/${req.file.filename}`;
    try {
      if (slot === 0) {
        const updated = await updateEvent(id, { thumbnail: imageUrl });
        if (!updated) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
      } else {
        const events = await readEvents();
        const event = events.find((e) => e.id === id);
        if (!event) return res.status(404).json({ success: false, error: "이벤트를 찾을 수 없습니다." });
        const extras: (string | null)[] = event.extraImages ? [...event.extraImages] : [];
        while (extras.length < slot) extras.push(null);
        extras[slot - 1] = imageUrl;
        await updateEvent(id, { extraImages: extras.filter(Boolean) as string[] });
      }
      req.log.info({ id, imageUrl, slot }, "이미지 업로드 완료");
      return res.json({ success: true, imageUrl, slot });
    } catch (e) {
      req.log.error({ e }, "이미지 업로드 후 저장 실패");
      return res.status(500).json({ success: false, error: "저장 실패" });
    }
  });
});

router.delete("/events", async (req, res) => {
  try {
    const { db, eventsTable } = await import("@workspace/db");
    await db.delete(eventsTable);
    res.json({ success: true, message: "전체 데이터 초기화 완료" });
  } catch (err) {
    req.log.error({ err }, "데이터 초기화 실패");
    res.status(500).json({ success: false, error: "초기화 실패" });
  }
});

router.patch("/events/bulk/approve", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids 배열이 필요합니다." });
    }
    const { db, eventsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");
    const result = await db
      .update(eventsTable)
      .set({ status: "approved" })
      .where(inArray(eventsTable.id, ids));
    req.log.info({ count: result.rowCount ?? 0 }, "일괄 승인 완료");
    return res.json({ success: true, approved: result.rowCount ?? 0 });
  } catch (err) {
    req.log.error({ err }, "일괄 승인 실패");
    return res.status(500).json({ success: false, error: "일괄 승인 실패" });
  }
});

router.delete("/events/bulk", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids 배열이 필요합니다." });
    }
    const { db, eventsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");
    const result = await db.delete(eventsTable).where(inArray(eventsTable.id, ids));
    return res.json({ success: true, removed: result.rowCount ?? 0 });
  } catch (err) {
    req.log.error({ err }, "일괄 삭제 실패");
    return res.status(500).json({ success: false, error: "일괄 삭제 실패" });
  }
});

router.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteEvent } = await import("../lib/storage.js");
    const removed = await deleteEvent(id);
    res.json({ success: true, removed: removed ? 1 : 0 });
  } catch (err) {
    req.log.error({ err }, "삭제 실패");
    res.status(500).json({ success: false, error: "삭제 실패" });
  }
});

// ─── 공개 소식 제보 (인증 불필요) ───────────────────────────────────────────────
router.post("/submit", async (req, res) => {
  try {
    const {
      title, description, link, contact,
      category, startDate: rawStart, endDate: rawEnd, location,
    } = req.body as {
      title?: string;
      description?: string;
      link?: string;
      contact?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      location?: string;
    };

    if (!title || title.trim().length < 2) {
      return res.status(400).json({ success: false, error: "제목을 2자 이상 입력해 주세요." });
    }

    const { startDate, endDate, scheduleStatus } = parseDates(
      `${rawStart || ""}${rawEnd ? `~${rawEnd}` : ""}`,
    );
    const eventId = crypto.createHash("md5").update(`tip:${title}:${Date.now()}`).digest("hex");
    const siteUrl = process.env["SITE_URL"] ?? "https://playgangneung.com";

    const event: CrawledEvent = {
      id: eventId,
      title: title.trim(),
      description: description?.trim() || "",
      date: startDate || rawStart || "",
      startDate: startDate || rawStart || "",
      endDate: endDate || rawEnd || "",
      scheduleStatus,
      location: location?.trim() || "강릉",
      category: category || detectCategory(title, description || ""),
      thumbnail: null,
      extraImages: null,
      videoUrl: null,
      link: link?.trim() || `${siteUrl}/content/${eventId}`,
      source: contact?.trim() ? `제보: ${contact.trim()}` : "제보",
      contact: contact?.trim() || "",
      sourceType: "tip",
      status: "submitted",
      socialDraft: null,
      hashtags: null,
      crawledAt: new Date().toISOString(),
    };

    const { added, updated } = await appendEvents([event]);
    req.log.info({ eventId, title: event.title }, "소식 제보 접수");

    // 관리자 이메일 알림 (fire & forget — 실패해도 제보 접수 성공)
    const adminEmail = process.env["ADMIN_EMAIL"] ?? process.env["SMTP_FROM"] ?? process.env["SMTP_USER"];
    if (adminEmail && isMailConfigured()) {
      sendMail({
        to: adminEmail,
        subject: `[PLAY강릉] 새 소식 제보: ${event.title}`,
        html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;padding:24px;background:#f9fafb">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#0d9488;padding:20px 28px">
      <div style="color:#fff;font-size:18px;font-weight:700">PLAY강릉</div>
      <div style="color:#99f6e4;font-size:12px;margin-top:2px">새 소식 제보 접수</div>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 16px;color:#374151;font-size:14px">새로운 소식 제보가 접수됐습니다. 관리자 대시보드에서 확인 후 검토해 주세요.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <tr style="background:#f9fafb"><td style="padding:10px 14px;color:#6b7280;font-size:12px;width:80px">제목</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827">${event.title}</td></tr>
        <tr style="border-top:1px solid #e5e7eb"><td style="padding:10px 14px;color:#6b7280;font-size:12px">카테고리</td><td style="padding:10px 14px;font-size:13px;color:#374151">${event.category}</td></tr>
        <tr style="border-top:1px solid #e5e7eb"><td style="padding:10px 14px;color:#6b7280;font-size:12px">장소</td><td style="padding:10px 14px;font-size:13px;color:#374151">${event.location || "-"}</td></tr>
        <tr style="border-top:1px solid #e5e7eb"><td style="padding:10px 14px;color:#6b7280;font-size:12px">제보자</td><td style="padding:10px 14px;font-size:13px;color:#374151">${event.contact || "-"}</td></tr>
        ${event.description ? `<tr style="border-top:1px solid #e5e7eb"><td style="padding:10px 14px;color:#6b7280;font-size:12px">내용</td><td style="padding:10px 14px;font-size:13px;color:#374151">${event.description}</td></tr>` : ""}
      </table>
      <div style="margin-top:20px;text-align:center">
        <a href="${siteUrl}/admin" style="display:inline-block;padding:12px 28px;background:#1e40af;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">관리자 대시보드에서 확인하기</a>
      </div>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f3f4f6;background:#f9fafb">
      <p style="margin:0;color:#9ca3af;font-size:11px">본 메일은 PLAY강릉 소식 제보 자동 알림입니다.</p>
    </div>
  </div>
</div>`,
        text: `새 소식 제보\n제목: ${event.title}\n카테고리: ${event.category}\n장소: ${event.location || "-"}\n제보자: ${event.contact || "-"}\n\n관리자 대시보드: ${siteUrl}/admin`,
      }).catch(() => {});
    }

    return res.json({ success: true, added, updated, id: eventId });
  } catch (err) {
    req.log.error({ err }, "소식 제보 실패");
    return res.status(500).json({ success: false, error: "제보 접수 중 오류가 발생했습니다." });
  }
});

export default router;
