import { Router } from "express";
import { db, eventsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const router = Router();

router.get("/tags/popular", async (req, res) => {
  try {
    const rows = await db
      .select({ hashtags: eventsTable.hashtags })
      .from(eventsTable)
      .where(inArray(eventsTable.status, ["approved", "published"]));

    const tagCounts = new Map<string, number>();
    for (const row of rows) {
      const tags = row.hashtags as string[] | null;
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (!tag || typeof tag !== "string") continue;
        const normalized = tag.startsWith("#") ? tag : `#${tag}`;
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }

    const sorted = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    res.json({ tags: sorted });
  } catch (err) {
    req.log.error({ err }, "인기 태그 조회 실패");
    res.status(500).json({ error: "인기 태그 조회 실패" });
  }
});

export default router;
