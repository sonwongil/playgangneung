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
import { parseDates, detectCategory } from "../lib/dateParser.js";
import crypto from "crypto";

const router = Router();

type EnrichedEvent = CrawledEvent;

const MOCK_EVENTS: EnrichedEvent[] = [
  {
    id: "mock-1",
    title: "2026 강릉 커피축제",
    description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제. 다양한 커피 체험과 전시, 공연을 즐겨보세요.",
    date: "2026-05-10", startDate: "2026-05-10", endDate: "2026-05-12", scheduleStatus: "upcoming",
    location: "강릉시 경포로 일원", category: "행사",
    thumbnail: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "manual",
    status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-06T09:00:00.000Z",
  },
  {
    id: "mock-2",
    title: "안목해변 카페거리 맛집 탐방",
    description: "강릉 안목해변을 따라 즐비한 개성 넘치는 카페와 식당들을 소개합니다. 바다를 보며 즐기는 커피 한 잔.",
    date: "2026-05-08", startDate: "2026-05-08", endDate: "", scheduleStatus: "upcoming",
    location: "강릉시 안목해변로", category: "맛집",
    thumbnail: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "manual",
    status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-06T08:30:00.000Z",
  },
  {
    id: "mock-3",
    title: "경포해변 일출 명소",
    description: "강릉 경포해변에서 바라보는 아름다운 일출. 한국의 대표적인 해돋이 명소를 소개합니다.",
    date: "2026-05-06", startDate: "2026-05-06", endDate: "", scheduleStatus: "today",
    location: "경포해변", category: "핫플",
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "PLAY강릉", sourceType: "manual",
    status: "approved",
    socialDraft: { title: "경포해변 일출 명소", caption: "경포해변 일출을 소개합니다! 🌅 강릉의 아름다운 해돋이를 함께해요.", hashtags: ["강릉", "경포해변", "일출", "핫플"], createdAt: "2026-05-05T20:00:00.000Z" },
    cardImageUrl: null, crawledAt: "2026-05-05T20:00:00.000Z",
  },
  {
    id: "mock-4",
    title: "강릉 단오제 준비 위원회 출범",
    description: "유네스코 무형문화유산에 등재된 강릉단오제의 2026년 행사 준비가 시작되었습니다.",
    date: "2026-05-01", startDate: "2026-05-01", endDate: "", scheduleStatus: "ended",
    location: "강릉시청", category: "지역소식",
    thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "manual",
    status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "mock-5",
    title: "강릉 초당 순두부 골목",
    description: "강릉의 대표 향토음식, 초당 순두부. 동해 바닷물로 만든 부드럽고 담백한 순두부를 맛보세요.",
    date: "2026-05-03", startDate: "2026-05-03", endDate: "", scheduleStatus: "ended",
    location: "강릉시 초당동", category: "맛집",
    thumbnail: "https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "manual",
    status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-03T11:00:00.000Z",
  },
  {
    id: "mock-6",
    title: "오죽헌 문화재 야간 개방",
    description: "신사임당과 율곡 이이의 생가, 오죽헌에서 진행되는 특별 야간 문화 행사.",
    date: "2026-05-15", startDate: "2026-05-15", endDate: "2026-05-17", scheduleStatus: "upcoming",
    location: "오죽헌시립박물관", category: "행사",
    thumbnail: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉문화재단", sourceType: "manual",
    status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-04T09:00:00.000Z",
  },
  {
    id: "mock-7",
    title: "강릉 바우길 트레킹",
    description: "동해 바다와 백두대간을 잇는 강릉 바우길. 봄 트레킹 코스를 소개합니다.",
    date: "2026-05-12", startDate: "2026-05-12", endDate: "", scheduleStatus: "upcoming",
    location: "강릉 바우길 1코스", category: "핫플",
    thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "manual",
    status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-02T14:00:00.000Z",
  },
  {
    id: "mock-8",
    title: "강릉 아트 페스타 2026",
    description: "강릉을 대표하는 예술 축제. 지역 예술가들의 작품 전시와 공연이 함께 펼쳐집니다.",
    date: "2026-05-20", startDate: "2026-05-20", endDate: "2026-05-25", scheduleStatus: "upcoming",
    location: "강릉문화예술관", category: "행사",
    thumbnail: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80",
    link: "https://www.gangneung.go.kr", source: "강릉문화재단", sourceType: "manual",
    status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-02T10:00:00.000Z",
  },
];

const THUMBNAIL_MAP: Record<string, string> = {
  행사: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  맛집: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
  핫플: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  지역소식: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
};

function enrichEvent(event: CrawledEvent): EnrichedEvent {
  const category = event.category || detectCategory(event.title, event.description) || "지역소식";
  const thumbnail = event.thumbnail || THUMBNAIL_MAP[category] || THUMBNAIL_MAP["지역소식"];
  const { startDate, endDate, scheduleStatus } = event.startDate
    ? { startDate: event.startDate, endDate: event.endDate, scheduleStatus: event.scheduleStatus }
    : parseDates(event.date);
  return { ...event, category, thumbnail, startDate, endDate, scheduleStatus };
}

router.get("/events", async (req, res) => {
  try {
    const stored = await readEvents();
    const storedIds = new Set(stored.map((e) => e.id));
    const enrichedStored = stored.map(enrichEvent);
    const supplementMocks = MOCK_EVENTS.filter((m) => !storedIds.has(m.id));
    const events = [...enrichedStored, ...supplementMocks];
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
