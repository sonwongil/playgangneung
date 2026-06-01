import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { db, dailyTop5Table, eventsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

router.get("/top5", async (req, res) => {
  try {
    const dateParam = (req.query["date"] as string | undefined) ?? todayKST();
    const row = await db
      .select()
      .from(dailyTop5Table)
      .where(eq(dailyTop5Table.date, dateParam))
      .limit(1);

    if (!row[0] || row[0].items.length === 0) {
      return res.json({ date: dateParam, items: [] });
    }

    const slotItems = row[0].items;
    const eventIds = slotItems.map((s) => s.eventId);

    const events = await db
      .select()
      .from(eventsTable)
      .where(inArray(eventsTable.id, eventIds));

    const eventMap = new Map(events.map((e) => [e.id, e]));
    const items = slotItems
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

    return res.json({ date: dateParam, items });
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
      .orderBy(dailyTop5Table.date);
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

router.delete("/top5", requireAdmin, async (req, res) => {
  try {
    const { date: dateParam } = req.body as { date?: string };
    const targetDate = dateParam ?? todayKST();
    await db.delete(dailyTop5Table).where(eq(dailyTop5Table.date, targetDate));
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "TOP 5 삭제 실패");
    return res.status(500).json({ error: "TOP 5 삭제 실패" });
  }
});

export default router;
