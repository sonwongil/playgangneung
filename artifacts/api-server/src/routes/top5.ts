import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { db, dailyTop5Table, eventsTable } from "@workspace/db";
import { eq, inArray, or, desc, ne } from "drizzle-orm";
import { uploadPagePhoto, createPageCarouselPost } from "../lib/metaApi.js";

const router = Router();

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

type SlotItem = { eventId: string; rank: number };

async function enrichSlots(slotItems: SlotItem[]) {
  if (slotItems.length === 0) return [];
  const eventIds = slotItems.map((s) => s.eventId);
  const events = await db.select().from(eventsTable).where(inArray(eventsTable.id, eventIds));
  const eventMap = new Map(events.map((e) => [e.id, e]));
  return slotItems
    .sort((a, b) => a.rank - b.rank)
    .map((slot) => {
      const ev = eventMap.get(slot.eventId);
      if (!ev) return null;
      return {
        rank: slot.rank,
        eventId: slot.eventId,
        id: ev.id,
        title: ev.title,
        description: ev.description,
        thumbnail: ev.thumbnail,
        category: ev.category,
        location: ev.location,
        date: ev.startDate || ev.date,
        startDate: ev.startDate,
        endDate: ev.endDate,
        scheduleStatus: ev.scheduleStatus,
        link: ev.link,
        source: ev.source,
        hashtags: ev.hashtags,
      };
    })
    .filter(Boolean);
}

router.get("/top5", async (req, res) => {
  try {
    const dateParam = (req.query["date"] as string | undefined) ?? todayKST();

    // ── 1순위: 오늘 daily_top5 ──────────────────────────────────────
    const todayRow = await db
      .select()
      .from(dailyTop5Table)
      .where(eq(dailyTop5Table.date, dateParam))
      .limit(1);

    if (todayRow[0] && todayRow[0].items.length > 0) {
      const items = await enrichSlots(todayRow[0].items as SlotItem[]);
      return res.json({ date: dateParam, items });
    }

    // ── 2순위: 가장 최근 daily_top5 이력 ───────────────────────────
    const recentRow = await db
      .select()
      .from(dailyTop5Table)
      .where(ne(dailyTop5Table.date, dateParam))
      .orderBy(desc(dailyTop5Table.date))
      .limit(1);

    if (recentRow[0] && recentRow[0].items.length > 0) {
      const items = await enrichSlots(recentRow[0].items as SlotItem[]);
      return res.json({
        date: dateParam,
        items,
        isHistorical: true,
        top5Date: recentRow[0].date,
      });
    }

    // ── 3순위: daily_top5 이력 없을 때만 — 자동 폴백 ───────────────
    const SCHEDULE_ORDER: Record<string, number> = {
      today: 0, ongoing: 1, tomorrow: 2, upcoming: 3, dateUnknown: 4, ended: 5,
    };
    const candidates = await db
      .select()
      .from(eventsTable)
      .where(or(eq(eventsTable.status, "approved"), eq(eventsTable.status, "published")))
      .limit(30);

    const autoItems = candidates
      .sort((a, b) => {
        const sa = SCHEDULE_ORDER[a.scheduleStatus ?? ""] ?? 4;
        const sb = SCHEDULE_ORDER[b.scheduleStatus ?? ""] ?? 4;
        if (sa !== sb) return sa - sb;
        return (a.startDate ?? "").localeCompare(b.startDate ?? "");
      })
      .slice(0, 5)
      .map((ev, i) => ({
        rank: i + 1,
        eventId: ev.id,
        id: ev.id,
        title: ev.title,
        description: ev.description,
        thumbnail: ev.thumbnail,
        category: ev.category,
        location: ev.location,
        date: ev.startDate || ev.date,
        startDate: ev.startDate,
        endDate: ev.endDate,
        scheduleStatus: ev.scheduleStatus,
        link: ev.link,
        source: ev.source,
        hashtags: ev.hashtags,
      }));

    return res.json({ date: dateParam, items: autoItems, auto: true });
  } catch (err) {
    req.log.error({ err }, "TOP 5 조회 실패");
    return res.status(500).json({ error: "TOP 5 조회 실패" });
  }
});

router.get("/top5/history", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({ date: dailyTop5Table.date, itemCount: dailyTop5Table.items })
      .from(dailyTop5Table)
      .orderBy(desc(dailyTop5Table.date));
    const history = rows.map((r) => ({
      date: r.date,
      count: (r.itemCount as unknown[]).length,
    }));
    return res.json({ history });
  } catch (err) {
    req.log.error({ err }, "TOP 5 히스토리 조회 실패");
    return res.status(500).json({ error: "히스토리 조회 실패" });
  }
});

router.post("/top5", requireAdmin, async (req, res) => {
  try {
    const { date: dateParam, items } = req.body as {
      date?: string;
      items: { eventId: string; rank: number }[];
    };

    if (!Array.isArray(items)) return res.status(400).json({ error: "items 배열 필수" });
    if (items.length > 5) return res.status(400).json({ error: "최대 5개까지 설정 가능합니다" });

    const targetDate = dateParam ?? todayKST();
    const slotItems = items
      .slice(0, 5)
      .map((it, i) => ({ eventId: it.eventId, rank: it.rank ?? i + 1 }));

    await db
      .insert(dailyTop5Table)
      .values({ date: targetDate, items: slotItems })
      .onConflictDoUpdate({ target: dailyTop5Table.date, set: { items: slotItems } });

    return res.json({ success: true, date: targetDate, count: slotItems.length });
  } catch (err) {
    req.log.error({ err }, "TOP 5 저장 실패");
    return res.status(500).json({ error: "TOP 5 저장 실패" });
  }
});

// TOP5 → Meta 캐러셀 게시물 연동
router.post("/top5/carousel-to-meta", requireAdmin, async (req, res) => {
  try {
    const { cards } = req.body as {
      cards: { title: string; summary: string; imageUrl: string; linkUrl: string }[];
    };
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: "cards 배열 필수 (1개 이상)" });
    }

    const pageId = process.env["META_PAGE_ID"];
    if (!pageId) return res.status(503).json({ error: "META_PAGE_ID 환경변수 미설정" });

    // 각 카드 이미지를 페이지에 임시 업로드
    const photoIds: string[] = [];
    for (const card of cards) {
      if (card.imageUrl) {
        const r = await uploadPagePhoto(pageId, card.imageUrl, card.title);
        if (r.ok) photoIds.push(r.data.id);
        else req.log.warn({ err: r.error }, `사진 업로드 실패: ${card.title}`);
      }
    }

    // 게시물 메시지 조합
    const message = [
      "🏖️ PLAY강릉 오늘의 TOP5",
      "",
      ...cards.map((c, i) => `${i + 1}. ${c.title}\n🔗 ${c.linkUrl}`),
    ].join("\n");

    const postResult = await createPageCarouselPost(pageId, message, photoIds);
    if (!postResult.ok) {
      req.log.error({ err: postResult.error }, "Meta 페이지 게시 실패");
      const { isTokenExpiredError, TOKEN_EXPIRED_USER_MSG } = await import("../lib/metaApi.js");
      const expired = isTokenExpiredError(postResult.error, postResult.code);
      return res.status(502).json({
        error: expired ? TOKEN_EXPIRED_USER_MSG : "Meta 게시 실패. 잠시 후 다시 시도해 주세요.",
        tokenExpired: expired,
        devError: postResult.error,
      });
    }

    return res.json({ ok: true, postId: postResult.data.id, photoCount: photoIds.length });
  } catch (err) {
    req.log.error({ err }, "carousel-to-meta 오류");
    return res.status(500).json({ error: "서버 오류" });
  }
});

router.delete("/top5", requireAdmin, async (req, res) => {
  try {
    const { date: dateParam } = (req.body ?? {}) as { date?: string };
    const targetDate = dateParam ?? todayKST();
    await db.delete(dailyTop5Table).where(eq(dailyTop5Table.date, targetDate));
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "TOP 5 삭제 실패");
    return res.status(500).json({ error: "TOP 5 삭제 실패" });
  }
});

export default router;
