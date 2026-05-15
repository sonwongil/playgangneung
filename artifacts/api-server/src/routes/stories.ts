import { Router } from "express";
import { db, storiesTable } from "@workspace/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import crypto from "crypto";
import {
  crawlStories,
  listBlogSources,
  addBlogSource,
  deleteBlogSource,
  toggleBlogSource,
} from "../lib/storyCrawler.js";

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

// ─── 네이버 블로그 소스 관리 ─────────────────────────────────────────────────

router.get("/stories/blogs", async (req, res) => {
  try {
    const blogs = await listBlogSources();
    return res.json({ blogs });
  } catch (err) {
    req.log.error({ err }, "블로그 소스 조회 실패");
    return res.status(500).json({ error: "블로그 소스 조회 실패" });
  }
});

router.post("/stories/blogs", async (req, res) => {
  try {
    const { name, blogId } = req.body as { name?: string; blogId?: string };
    if (!blogId) return res.status(400).json({ error: "blogId 필수" });
    const row = await addBlogSource(name ?? "", blogId);
    if (!row) return res.status(409).json({ error: "이미 등록된 블로그입니다" });
    return res.json({ blog: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "블로그 소스 추가 실패");
    return res.status(500).json({ error: msg });
  }
});

router.patch("/stories/blogs/:id/toggle", async (req, res) => {
  try {
    const { enabled } = req.body as { enabled: boolean };
    await toggleBlogSource(req.params.id, enabled);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "블로그 소스 토글 실패");
    return res.status(500).json({ error: "토글 실패" });
  }
});

router.delete("/stories/blogs/:id", async (req, res) => {
  try {
    const ok = await deleteBlogSource(req.params.id);
    return res.json({ ok });
  } catch (err) {
    req.log.error({ err }, "블로그 소스 삭제 실패");
    return res.status(500).json({ error: "삭제 실패" });
  }
});

// ─── 스토리 크롤링 ─────────────────────────────────────────────────────────
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
