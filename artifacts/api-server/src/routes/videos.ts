import { Router } from "express";
import { db, videosTable } from "@workspace/db";
import { desc, eq, or } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

router.get("/videos", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(videosTable)
      .where(or(eq(videosTable.status, "approved"), eq(videosTable.status, "published")))
      .orderBy(desc(videosTable.createdAt));
    return res.json({ videos: rows });
  } catch (err) {
    req.log.error({ err }, "영상 조회 실패");
    return res.status(500).json({ error: "영상 조회 실패" });
  }
});

router.get("/videos/all", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(videosTable)
      .orderBy(desc(videosTable.createdAt));
    return res.json({ videos: rows });
  } catch (err) {
    req.log.error({ err }, "영상 목록 조회 실패");
    return res.status(500).json({ error: "영상 목록 조회 실패" });
  }
});

router.post("/videos", async (req, res) => {
  try {
    const { youtubeId, title, channelName, thumbnailUrl, description } = req.body as {
      youtubeId?: string; title?: string; channelName?: string;
      thumbnailUrl?: string; description?: string;
    };
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const thumb =
      thumbnailUrl ??
      (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null);
    const [row] = await db.insert(videosTable).values({
      id,
      youtubeId: youtubeId ?? "",
      title: title ?? "",
      channelName: channelName ?? "",
      thumbnailUrl: thumb,
      description: description ?? "",
      status: "draft",
    }).returning();
    return res.json({ video: row });
  } catch (err) {
    req.log.error({ err }, "영상 등록 실패");
    return res.status(500).json({ error: "영상 등록 실패" });
  }
});

router.patch("/videos/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };
    await db
      .update(videosTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(videosTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "영상 상태 변경 실패");
    return res.status(500).json({ error: "영상 상태 변경 실패" });
  }
});

router.delete("/videos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(videosTable).where(eq(videosTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "영상 삭제 실패");
    return res.status(500).json({ error: "영상 삭제 실패" });
  }
});

export default router;
