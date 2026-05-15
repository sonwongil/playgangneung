import { Router } from "express";
import { db, storiesTable } from "@workspace/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import crypto from "crypto";
import { crawlStories } from "../lib/storyCrawler.js";
import { searchNaverBlog } from "../lib/naverBlog.js";

const router = Router();

router.get("/stories", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .where(or(eq(storiesTable.status, "approved"), eq(storiesTable.status, "published")))
      .orderBy(desc(storiesTable.createdAt));
    return res.json({ stories: rows });
  } catch (err) {
    req.log.error({ err }, "스토리 조회 실패");
    return res.status(500).json({ error: "스토리 조회 실패" });
  }
});

router.get("/stories/all", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(storiesTable)
      .orderBy(desc(storiesTable.createdAt));
    return res.json({ stories: rows });
  } catch (err) {
    req.log.error({ err }, "스토리 목록 조회 실패");
    return res.status(500).json({ error: "스토리 목록 조회 실패" });
  }
});

// ─── 네이버 블로그 키워드 검색 수집 ─────────────────────────────────────────

router.post("/stories/naver-crawl", async (req, res) => {
  try {
    const { query, display, period } = req.body as {
      query?: string;
      display?: number;
      period?: { unit: "days" | "months" | "years"; value: number };
    };
    if (!query?.trim()) return res.status(400).json({ error: "검색어(query) 필수" });

    let sinceDate: Date | undefined;
    if (period && period.value > 0) {
      const now = new Date();
      if (period.unit === "days") {
        sinceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - period.value);
      } else if (period.unit === "months") {
        sinceDate = new Date(now.getFullYear(), now.getMonth() - period.value, now.getDate());
      } else if (period.unit === "years") {
        sinceDate = new Date(now.getFullYear() - period.value, now.getMonth(), now.getDate());
      }
    }

    const { items, total, error } = await searchNaverBlog({
      query: query.trim(),
      display: display ?? 30,
      sort: "date",
      sinceDate,
    });

    if (error) return res.status(500).json({ error });

    if (items.length === 0) {
      return res.json({ added: 0, skipped: 0, total, message: "검색 결과 없음" });
    }

    const ids = items.map((s) => s.id);
    const existing = await db
      .select({ id: storiesTable.id })
      .from(storiesTable)
      .where(inArray(storiesTable.id, ids));
    const existingSet = new Set(existing.map((r) => r.id));

    const toInsert = items.filter((s) => !existingSet.has(s.id));
    if (toInsert.length > 0) {
      await db.insert(storiesTable).values(
        toInsert.map((s) => ({
          id: s.id,
          title: s.title,
          body: s.body,
          images: s.images,
          sourceUrl: s.sourceUrl,
          author: s.author,
          tags: s.tags,
          status: "draft" as const,
        })),
      );
    }

    req.log.info({ query, added: toInsert.length, total }, "네이버 블로그 수집 완료");
    return res.json({
      added: toInsert.length,
      skipped: items.length - toInsert.length,
      total,
      message: `"${query}" — ${toInsert.length}개 새로 수집, ${items.length - toInsert.length}개 중복 스킵`,
    });
  } catch (err) {
    req.log.error({ err }, "네이버 블로그 수집 실패");
    return res.status(500).json({ error: "네이버 블로그 수집 실패" });
  }
});

// ─── 스토리 크롤링 (RSS) ──────────────────────────────────────────────────
router.post("/stories/crawl", async (req, res) => {
  try {
    const { stories: crawled, errors } = await crawlStories();
    if (crawled.length === 0) {
      return res.json({ added: 0, skipped: 0, errors, message: "수집된 항목 없음" });
    }

    const ids = crawled.map((s) => s.id);
    const existing = await db
      .select({ id: storiesTable.id })
      .from(storiesTable)
      .where(inArray(storiesTable.id, ids));
    const existingSet = new Set(existing.map((r) => r.id));

    const toInsert = crawled.filter((s) => !existingSet.has(s.id));
    if (toInsert.length > 0) {
      await db.insert(storiesTable).values(
        toInsert.map((s) => ({
          id: s.id,
          title: s.title,
          body: s.body,
          images: s.images,
          sourceUrl: s.sourceUrl,
          author: s.author,
          tags: s.tags,
          status: "draft" as const,
        })),
      );
    }

    req.log.info({ added: toInsert.length, skipped: crawled.length - toInsert.length }, "스토리 크롤링 저장 완료");
    return res.json({
      added: toInsert.length,
      skipped: crawled.length - toInsert.length,
      errors,
      message: `${toInsert.length}개 새로 수집, ${crawled.length - toInsert.length}개 중복 스킵`,
    });
  } catch (err) {
    req.log.error({ err }, "스토리 크롤링 실패");
    return res.status(500).json({ error: "스토리 크롤링 실패" });
  }
});

router.post("/stories", async (req, res) => {
  try {
    const { title, body, images, sourceUrl, author, tags } = req.body as {
      title?: string; body?: string; images?: string[];
      sourceUrl?: string; author?: string; tags?: string[];
    };
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const [row] = await db.insert(storiesTable).values({
      id,
      title: title ?? "",
      body: body ?? "",
      images: images ?? [],
      sourceUrl: sourceUrl ?? "",
      author: author ?? "",
      tags: tags ?? [],
      status: "draft",
    }).returning();
    return res.json({ story: row });
  } catch (err) {
    req.log.error({ err }, "스토리 등록 실패");
    return res.status(500).json({ error: "스토리 등록 실패" });
  }
});

router.patch("/stories/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };
    await db
      .update(storiesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(storiesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "스토리 상태 변경 실패");
    return res.status(500).json({ error: "스토리 상태 변경 실패" });
  }
});

router.delete("/stories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(storiesTable).where(eq(storiesTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "스토리 삭제 실패");
    return res.status(500).json({ error: "스토리 삭제 실패" });
  }
});

export default router;
