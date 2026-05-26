import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { db, storiesTable } from "@workspace/db";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import crypto from "crypto";
import { crawlStories, fetchNaverBlogImages } from "../lib/storyCrawler.js";
import { searchNaverBlog } from "../lib/naverBlog.js";

const router = Router();

router.use((req, res, next) => {
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) {
    return requireAdmin(req, res, next);
  }
  next();
});

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

// ─── URL에서 제목·본문·이미지·작성자 자동 추출 ───────────────────────────────
router.post("/stories/extract-url", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url?.trim()) return res.status(400).json({ error: "url 필수" });

  try {
    const isNaver = url.includes("naver");
    const fetchUrl = isNaver
      ? url.replace("blog.naver.com", "m.blog.naver.com").split("?")[0]
      : url;

    const { default: axios } = await import("axios");
    const https = await import("https");
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    const resp = await axios.get(fetchUrl, {
      headers: {
        "User-Agent": isNaver
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
          : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: isNaver ? "https://m.blog.naver.com/" : url,
      },
      httpsAgent,
      timeout: 10000,
      responseType: "text",
    });

    const cheerio = await import("cheerio");
    const $ = cheerio.load(resp.data as string);

    const ogTitle   = $('meta[property="og:title"]').attr("content")?.trim()
                   ?? $("title").text().trim()
                   ?? "";
    const ogDesc    = $('meta[property="og:description"]').attr("content")?.trim()
                   ?? $('meta[name="description"]').attr("content")?.trim()
                   ?? "";
    const ogAuthor  = $('meta[name="author"]').attr("content")?.trim()
                   ?? $('meta[property="og:site_name"]').attr("content")?.trim()
                   ?? "";

    let images: string[] = [];
    if (isNaver) {
      images = await fetchNaverBlogImages(url, 5);
    }
    if (images.length === 0) {
      const ogImg = $('meta[property="og:image"]').attr("content")?.trim();
      if (ogImg) images = [ogImg];
    }

    return res.json({ title: ogTitle, body: ogDesc, images, author: ogAuthor });
  } catch (err) {
    req.log.warn({ err, url }, "URL 자동 추출 실패");
    return res.status(500).json({ error: "URL에서 정보를 가져오지 못했습니다" });
  }
});

// ─── 이미지 없는 스토리 재추출 ────────────────────────────────────────────────
router.post("/stories/refetch-images", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    const targetIds = Array.isArray(ids) && ids.length > 0 ? ids : null;

    let rows: { id: string; sourceUrl: string }[];

    if (targetIds) {
      // 선택된 ID들 — 이미지 유무 관계없이 강제 재추출
      rows = await db
        .select({ id: storiesTable.id, sourceUrl: storiesTable.sourceUrl })
        .from(storiesTable)
        .where(inArray(storiesTable.id, targetIds));
    } else {
      // 선택 없음 — 이미지가 비어있는 스토리 최대 30개 (모든 소스)
      rows = await db
        .select({ id: storiesTable.id, sourceUrl: storiesTable.sourceUrl })
        .from(storiesTable)
        .where(sql`jsonb_array_length(${storiesTable.images}) = 0 AND ${storiesTable.sourceUrl} IS NOT NULL AND ${storiesTable.sourceUrl} != ''`)
        .limit(30);

      if (rows.length === 0) {
        return res.json({ updated: 0, checked: 0, message: "이미지 없는 스토리가 없습니다" });
      }
    }

    let updated = 0;
    const errors: string[] = [];

    const { default: axios } = await import("axios");
    const https = await import("https");
    const cheerio = await import("cheerio");
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    for (const row of rows) {
      try {
        let imgs: string[] = [];

        if (row.sourceUrl?.includes("naver")) {
          // 네이버 블로그: 모바일 HTML에서 다중 이미지 추출
          imgs = await fetchNaverBlogImages(row.sourceUrl, 5);
        }

        // 네이버가 아니거나 이미지를 못 찾은 경우 — OG 이미지 fallback
        if (imgs.length === 0 && row.sourceUrl) {
          try {
            const resp = await axios.get(row.sourceUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "ko-KR,ko;q=0.9",
              },
              httpsAgent,
              timeout: 8000,
              responseType: "text",
            });
            const $ = cheerio.load(resp.data as string);
            const ogImg = $('meta[property="og:image"]').attr("content")?.trim();
            if (ogImg) imgs = [ogImg];
          } catch {
            // OG 추출 실패 무시
          }
        }

        if (imgs.length > 0) {
          await db
            .update(storiesTable)
            .set({ images: imgs, updatedAt: new Date() })
            .where(eq(storiesTable.id, row.id));
          updated++;
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    req.log.info({ updated, total: rows.length, targetIds }, "이미지 재추출 완료");
    return res.json({
      updated,
      checked: rows.length,
      errors,
      message: `${rows.length}개 중 ${updated}개 이미지 추출 성공`,
    });
  } catch (err) {
    req.log.error({ err }, "이미지 재추출 실패");
    return res.status(500).json({ error: "이미지 재추출 실패" });
  }
});

router.delete("/stories/bulk", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids 필수" });
    await db.delete(storiesTable).where(inArray(storiesTable.id, ids));
    return res.json({ removed: ids.length });
  } catch (err) {
    req.log.error({ err }, "스토리 일괄 삭제 실패");
    return res.status(500).json({ error: "일괄 삭제 실패" });
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
