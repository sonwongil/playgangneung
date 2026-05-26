import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { db, videosTable } from "@workspace/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import crypto from "crypto";
import { fetchYoutubeInfo, crawlYoutubeVideos } from "../lib/youtube.js";

const router = Router();

router.use((req, res, next) => {
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) {
    return requireAdmin(req, res, next);
  }
  next();
});

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

// ─── YouTube 영상 정보 미리보기 추출 ─────────────────────────────────────────
router.get("/videos/extract", async (req, res) => {
  const { url } = req.query as { url?: string };
  if (!url) return res.status(400).json({ error: "url 필수" });
  const info = await fetchYoutubeInfo(url);
  if (!info) return res.status(404).json({ error: "YouTube 정보 조회 실패" });
  return res.json(info);
});

// ─── YouTube 자동 수집 ────────────────────────────────────────────────────────
router.post("/videos/crawl", async (req, res) => {
  try {
    const { query, channelId, maxResults, period } = req.body as {
      query?: string; channelId?: string; maxResults?: number;
      period?: { unit: "days" | "months" | "years"; value: number };
    };

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

    const { videos: crawled, error } = await crawlYoutubeVideos({
      query: query ?? "강릉",
      channelId,
      maxResults: maxResults ?? 50,
      sinceDate,
    });
    if (error) return res.status(502).json({ error });
    if (crawled.length === 0) return res.json({ added: 0, skipped: 0, message: "수집된 영상 없음" });

    // 중복 제거: 같은 youtubeId가 이미 있으면 스킵
    const youtubeIds = crawled.map((v) => v.youtubeId);
    const existing = await db
      .select({ youtubeId: videosTable.youtubeId })
      .from(videosTable)
      .where(inArray(videosTable.youtubeId, youtubeIds));
    const existingSet = new Set(existing.map((r) => r.youtubeId));

    const toInsert = crawled.filter((v) => !existingSet.has(v.youtubeId));
    if (toInsert.length > 0) {
      await db.insert(videosTable).values(
        toInsert.map((v) => ({
          id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          youtubeId: v.youtubeId,
          title: v.title,
          channelName: v.channelName,
          thumbnailUrl: v.thumbnailUrl,
          description: v.description,
          embeddable: v.embeddable,
          viewCount: v.viewCount,
          status: "draft" as const,
        })),
      );
    }

    req.log.info({ added: toInsert.length, skipped: crawled.length - toInsert.length }, "YouTube 크롤링 저장 완료");
    return res.json({
      added: toInsert.length,
      skipped: crawled.length - toInsert.length,
      message: `${toInsert.length}개 새로 수집, ${crawled.length - toInsert.length}개 중복 스킵`,
    });
  } catch (err) {
    req.log.error({ err }, "YouTube 크롤링 실패");
    return res.status(500).json({ error: "YouTube 크롤링 실패" });
  }
});

router.delete("/videos/bulk", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids 필수" });
    await db.delete(videosTable).where(inArray(videosTable.id, ids));
    return res.json({ removed: ids.length });
  } catch (err) {
    req.log.error({ err }, "영상 일괄 삭제 실패");
    return res.status(500).json({ error: "일괄 삭제 실패" });
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

// ─── SNS 문구 저장 ────────────────────────────────────────────────────────────
router.patch("/videos/:id/caption", async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body as { caption?: string };
    const [updated] = await db.update(videosTable)
      .set({ socialCaption: caption ?? null, updatedAt: new Date() })
      .where(eq(videosTable.id, id))
      .returning();
    return res.json({ video: updated });
  } catch (err) {
    req.log.error({ err }, "SNS 문구 저장 실패");
    return res.status(500).json({ error: "SNS 문구 저장 실패" });
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
