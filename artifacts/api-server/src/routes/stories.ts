import { Router } from "express";
import { db, storiesTable } from "@workspace/db";
import { desc, eq, or } from "drizzle-orm";
import crypto from "crypto";

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
