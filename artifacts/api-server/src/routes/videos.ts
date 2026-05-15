import { Router } from "express";
import { db, videosTable } from "@workspace/db";
import { desc, eq, or } from "drizzle-orm";
import crypto from "crypto";
import { fetchYoutubeInfo } from "../lib/youtube.js";

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
    const { youtubeUrl, youtubeId: rawId, title, channelName, thumbnailUrl, description } = req.body as {
      youtubeUrl?: string; youtubeId?: string; title?: string; channelName?: string;
      thumbnailUrl?: string; description?: string;
    };

    const rawInput = youtubeUrl ?? rawId ?? "";
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    // YouTube API로 정보 자동 조회
    const ytInfo = rawInput ? await fetchYoutubeInfo(rawInput) : null;

    const finalYoutubeId = ytInfo?.youtubeId ?? rawInput;
    const finalTitle = title || ytInfo?.title || "";
    const finalChannel = channelName || ytInfo?.channelName || "";
    const finalDesc = description || ytInfo?.description || "";
    const finalThumb = thumbnailUrl ?? ytInfo?.thumbnailUrl ??
      (finalYoutubeId ? `https://img.youtube.com/vi/${finalYoutubeId}/mqdefault.jpg` : null);

    const [row] = await db.insert(videosTable).values({
      id,
      youtubeId: finalYoutubeId,
      title: finalTitle,
      channelName: finalChannel,
      thumbnailUrl: finalThumb,
      description: finalDesc,
      embeddable: ytInfo?.embeddable ?? null,
      viewCount: ytInfo?.viewCount ?? null,
      status: "draft",
    }).returning();
    return res.json({ video: row });
  } catch (err) {
    req.log.error({ err }, "영상 등록 실패");
    return res.status(500).json({ error: "영상 등록 실패" });
  }
});

// 개별 영상 YouTube 정보 새로고침
router.post("/videos/:id/fetch", async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.select().from(videosTable).where(eq(videosTable.id, id));
    const video = rows[0];
    if (!video) return res.status(404).json({ error: "영상 없음" });

    const ytInfo = await fetchYoutubeInfo(video.youtubeId);
    if (!ytInfo) return res.status(502).json({ error: "YouTube API 조회 실패" });

    const [updated] = await db.update(videosTable).set({
      title: ytInfo.title || video.title,
      channelName: ytInfo.channelName || video.channelName,
      thumbnailUrl: ytInfo.thumbnailUrl || video.thumbnailUrl,
      description: ytInfo.description || video.description,
      embeddable: ytInfo.embeddable,
      viewCount: ytInfo.viewCount,
      updatedAt: new Date(),
    }).where(eq(videosTable.id, id)).returning();

    return res.json({ video: updated });
  } catch (err) {
    req.log.error({ err }, "YouTube 정보 새로고침 실패");
    return res.status(500).json({ error: "새로고침 실패" });
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
