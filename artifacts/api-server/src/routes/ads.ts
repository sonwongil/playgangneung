import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { db, adsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { generateCardImage } from "../lib/card.js";
import { UPLOADS_DIR, CARDS_DIR } from "../lib/paths.js";
// lazy import — 서버 시작 시 환경변수 없어도 크래시 방지
async function getOpenAI() {
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    return openai;
  } catch {
    return null;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

export type AdStatus = "pending" | "approved" | "scheduled" | "published" | "rejected";
export type AdPlan = "basic" | "main" | "premium";

export interface SocialDraft {
  title: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

export interface Ad {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  title: string;
  description: string;
  date: string;
  location: string;
  url: string;
  imageUrl: string | null;
  extraImages?: string[];
  socialDraft: SocialDraft | null;
  plan: AdPlan;
  status: AdStatus;
  source: "광고접수";
  createdAt: string;
  approvedAt?: string;
  isFreeAd: true;
  aiScore: number | null;
  aiNote: string | null;
}

function rowToAd(row: typeof adsTable.$inferSelect): Ad {
  return {
    id: row.id,
    businessName: row.businessName,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    category: row.category,
    title: row.title,
    description: row.description,
    date: row.date,
    location: row.location,
    url: row.url,
    imageUrl: row.imageUrl ?? null,
    extraImages: (row.extraImages as string[] | null) ?? undefined,
    socialDraft: (row.socialDraft as SocialDraft | null) ?? null,
    plan: (row.plan as AdPlan) ?? "basic",
    status: (row.status as AdStatus) ?? "pending",
    source: "광고접수",
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    isFreeAd: true,
    aiScore: row.aiScore ?? null,
    aiNote: row.aiNote ?? null,
  };
}

function buildAdDraft(ad: Ad): SocialDraft {
  const SITE_URL = process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app";
  const EMOJI_MAP: Record<string, string> = { 맛집: "🍽️", 행사: "🎉", 핫플: "📍", 지역소식: "📢" };
  const HASHTAG_MAP: Record<string, string[]> = {
    맛집:    ["PLAY강릉", "강릉맛집", "강릉", "강릉여행", "강릉카페", "강원도맛집", "강릉핫플", "맛스타그램"],
    행사:    ["PLAY강릉", "강릉", "강릉행사", "강릉축제", "강릉여행", "강원도", "국내여행", "강릉나들이"],
    핫플:   ["PLAY강릉", "강릉핫플", "강릉", "강릉여행", "강릉명소", "강원도여행", "국내여행", "여행스타그램"],
    지역소식: ["PLAY강릉", "강릉", "강릉소식", "강릉시", "강원도", "강릉정보"],
  };
  const cat = ad.category ?? "기타";
  const emoji = EMOJI_MAP[cat] ?? "✨";
  const hashtags = (HASHTAG_MAP[cat] ?? ["PLAY강릉", "강릉"]);
  const contentLink = `${SITE_URL}/content/${ad.id}`;
  const parts: string[] = [`${emoji} ${ad.title}`];
  if (ad.date) parts.push(`🗓️ ${ad.date}`);
  if (ad.location) parts.push(`📍 ${ad.location}`);
  const rawDesc = ad.description
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (rawDesc.length > 10) {
    parts.push("");
    parts.push(rawDesc.length > 200 ? rawDesc.slice(0, 200) + "…" : rawDesc);
  }
  parts.push("");
  return {
    title: ad.title,
    caption: parts.join("\n").trim(),
    hashtags: hashtags.sort(() => Math.random() - 0.5).slice(0, 8),
    createdAt: new Date().toISOString(),
  };
}

router.get("/ads", async (req, res) => {
  try {
    const rows = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
    return res.json({ ads: rows.map(rowToAd), total: rows.length });
  } catch (err) {
    req.log.error({ err }, "ads 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

router.post("/ads", async (req, res) => {
  try {
    const body = req.body as Partial<Ad> & { extraImages?: string[] };
    const id = crypto.randomUUID();
    await db.insert(adsTable).values({
      id,
      businessName: body.businessName ?? "",
      contactName: body.contactName ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      category: body.category ?? "기타",
      title: body.title ?? "",
      description: body.description ?? "",
      date: body.date ?? "",
      location: body.location ?? "",
      url: body.url ?? "",
      imageUrl: body.imageUrl ?? null,
      extraImages: Array.isArray(body.extraImages) ? body.extraImages : null,
      plan: body.plan ?? "basic",
      status: "pending",
      isFreeAd: true,
    });
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    req.log.info({ id }, "광고 접수 완료");
    return res.status(201).json({ success: true, ad: rowToAd(row) });
  } catch (err) {
    req.log.error({ err }, "광고 접수 실패");
    return res.status(500).json({ error: "접수 실패" });
  }
});

router.patch("/ads/:id/ai-note", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "인증 필요" });
  try {
    const { id } = req.params;
    const body = req.body as { aiScore?: number | null; aiNote?: string | null };
    const updates: Partial<typeof adsTable.$inferInsert> = {};
    if ("aiScore" in body) updates.aiScore = body.aiScore ?? null;
    if ("aiNote" in body) updates.aiNote = body.aiNote ?? null;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "변경할 항목이 없습니다" });
    await db.update(adsTable).set(updates).where(eq(adsTable.id, id));
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    req.log.info({ id, aiScore: body.aiScore, aiNote: body.aiNote }, "광고 AI 검수 저장");
    return res.json({ success: true, ad: rowToAd(row) });
  } catch (err) {
    req.log.error({ err }, "광고 AI 검수 저장 실패");
    return res.status(500).json({ error: "저장 실패" });
  }
});

router.patch("/ads/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: AdStatus };
    const extra: Record<string, unknown> = {};
    if (status === "approved") {
      const [cur] = await db.select().from(adsTable).where(eq(adsTable.id, id));
      if (!cur) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
      if (!cur.approvedAt) extra.approvedAt = new Date();
    }
    await db.update(adsTable).set({ status, ...extra }).where(eq(adsTable.id, id));
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    req.log.info({ id, status }, "광고 상태 변경");
    return res.json({ success: true, ad: rowToAd(row) });
  } catch (err) {
    req.log.error({ err }, "광고 상태 변경 실패");
    return res.status(500).json({ error: "상태 변경 실패" });
  }
});

router.patch("/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as Partial<Ad> & { extraImages?: string[] };
    const patch: Record<string, unknown> = {};
    if ("title" in body) patch.title = body.title;
    if ("description" in body) patch.description = body.description;
    if ("businessName" in body) patch.businessName = body.businessName;
    if ("contactName" in body) patch.contactName = body.contactName;
    if ("phone" in body) patch.phone = body.phone;
    if ("email" in body) patch.email = body.email;
    if ("category" in body) patch.category = body.category;
    if ("date" in body) patch.date = body.date;
    if ("location" in body) patch.location = body.location;
    if ("url" in body) patch.url = body.url;
    if ("imageUrl" in body) patch.imageUrl = body.imageUrl;
    if ("extraImages" in body) patch.extraImages = body.extraImages ?? null;
    if ("socialDraft" in body) patch.socialDraft = body.socialDraft ?? null;
    if ("plan" in body) patch.plan = body.plan;
    await db.update(adsTable).set(patch).where(eq(adsTable.id, id));
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    req.log.info({ id }, "광고 수정 완료");
    return res.json({ success: true, ad: rowToAd(row) });
  } catch (err) {
    req.log.error({ err }, "광고 수정 실패");
    return res.status(500).json({ error: "수정 실패" });
  }
});

router.delete("/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.delete(adsTable).where(eq(adsTable.id, id)).returning();
    if (result.length === 0) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "광고 삭제 실패");
    return res.status(500).json({ error: "삭제 실패" });
  }
});

// ─── SNS 초안 생성 ────────────────────────────────────────────────────────────
router.post("/ads/:id/draft", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    const ad = rowToAd(row);
    const draft = buildAdDraft(ad);
    await db.update(adsTable).set({ socialDraft: draft }).where(eq(adsTable.id, id));
    req.log.info({ id }, "광고 SNS 초안 생성");
    return res.json({ success: true, draft });
  } catch (err) {
    req.log.error({ err }, "광고 SNS 초안 생성 실패");
    return res.status(500).json({ error: "초안 생성 실패" });
  }
});

// ─── 카드이미지 생성 ───────────────────────────────────────────────────────────
router.post("/ads/:id/card", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    const ad = rowToAd(row);
    await fs.mkdir(CARDS_DIR, { recursive: true });
    const desc = ad.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const base = { id: ad.id, title: ad.title, description: desc, category: ad.category, source: ad.businessName || "광고", date: ad.date };
    const allImages = [ad.imageUrl, ...(ad.extraImages ?? [])].filter(Boolean) as string[];
    const cardUrls: string[] = [];
    if (allImages.length === 0) {
      cardUrls.push(await generateCardImage({ ...base, thumbnail: undefined }));
    } else {
      for (let i = 0; i < allImages.length; i++) {
        cardUrls.push(await generateCardImage({ ...base, thumbnail: allImages[i], suffix: i === 0 ? "thumb" : `extra${i}` }));
      }
    }
    req.log.info({ id, count: cardUrls.length }, "광고 카드이미지 생성");
    return res.json({ success: true, cardUrls });
  } catch (err) {
    req.log.error({ err }, "광고 카드이미지 생성 실패");
    return res.status(500).json({ error: "카드이미지 생성 실패" });
  }
});

// ─── AI 문구 보정 ──────────────────────────────────────────────────────────────
router.post("/ads/:id/ai-improve", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "인증 필요" });
  try {
    const { id } = req.params;
    const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
    if (!row) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });

    const prompt = `당신은 강릉 지역 SNS 광고 카피라이터입니다.
아래 광고 문구를 검토하고 개선안을 제시하세요.

업체명: ${row.businessName}
카테고리: ${row.category}
제목: ${row.title}
설명: ${row.description.replace(/<[^>]*>/g, "").slice(0, 300)}

다음 항목을 JSON으로 응답하세요:
{
  "aiScore": 0-100 점수 (현재 문구 품질),
  "improvedTitle": "개선된 제목 (20자 이내)",
  "improvedDescription": "개선된 설명 (150자 이내, 강릉 특성 반영)",
  "aiNote": "검수 코멘트 (위험 표현, 개선 포인트 등 한 줄)",
  "issues": ["문제점1", "문제점2"]
}

주의사항:
- 과장 광고 표현 (최고, 100%, 보장 등) 감점
- 강릉 지역 특색 반영 시 가산점
- 자연스러운 한국어 사용
- SNS에 적합한 감성적 문구`;

    const openai = await getOpenAI();
    if (!openai) return res.status(503).json({ error: "AI 연동이 설정되지 않았습니다. 환경변수를 확인하세요." });

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "AI 응답 파싱 실패" });

    const result = JSON.parse(jsonMatch[0]) as {
      aiScore: number;
      improvedTitle: string;
      improvedDescription: string;
      aiNote: string;
      issues: string[];
    };

    // aiScore, aiNote 저장
    await db.update(adsTable).set({
      aiScore: Math.min(100, Math.max(0, Math.round(result.aiScore ?? 70))),
      aiNote: result.aiNote ?? "",
    }).where(eq(adsTable.id, id));

    req.log.info({ id, aiScore: result.aiScore }, "AI 문구 보정 완료");
    return res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "AI 문구 보정 실패");
    return res.status(500).json({ error: "AI 문구 보정 실패" });
  }
});

// ─── AI 배치 점검 ──────────────────────────────────────────────────────────────
router.post("/ads/ai-check-batch", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "인증 필요" });
  try {
    const rows = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
    const toCheck = rows.filter((r) => r.aiScore === null || r.aiScore === undefined);

    const openai = await getOpenAI();
    if (!openai) return res.status(503).json({ error: "AI 연동이 설정되지 않았습니다. 환경변수를 확인하세요." });

    let checked = 0;
    for (const row of toCheck.slice(0, 10)) {
      try {
        const prompt = `광고 문구를 간단히 점검하고 JSON으로 응답하세요.
업체: ${row.businessName}, 카테고리: ${row.category}
제목: ${row.title}
설명: ${(row.description ?? "").replace(/<[^>]*>/g, "").slice(0, 200)}

{"aiScore": 0-100, "aiNote": "한 줄 코멘트"}`;

        const response = await openai.chat.completions.create({
          model: "gpt-5-nano",
          max_completion_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });

        const raw = response.choices[0]?.message?.content ?? "{}";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]) as { aiScore: number; aiNote: string };
          await db.update(adsTable).set({
            aiScore: Math.min(100, Math.max(0, Math.round(result.aiScore ?? 70))),
            aiNote: result.aiNote ?? "",
          }).where(eq(adsTable.id, row.id));
          checked++;
        }
      } catch (_e) { /* 개별 실패 무시 */ }
    }

    req.log.info({ checked, total: toCheck.length }, "AI 배치 점검 완료");
    return res.json({ success: true, checked, skipped: toCheck.length - checked, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "AI 배치 점검 실패");
    return res.status(500).json({ error: "배치 점검 실패" });
  }
});

// ─── 이미지 업로드 ─────────────────────────────────────────────────────────────
router.post("/ads/:id/upload-image", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err instanceof Error ? err.message : "업로드 실패" });
    if (!req.file) return res.status(400).json({ success: false, error: "파일이 없습니다." });
    const { id } = req.params;
    const slot = Number(req.query["slot"] ?? "0");
    const imageUrl = `/api/uploads/${req.file.filename}`;
    try {
      const [row] = await db.select().from(adsTable).where(eq(adsTable.id, id));
      if (!row) return res.status(404).json({ success: false, error: "광고를 찾을 수 없습니다." });
      if (slot === 0) {
        await db.update(adsTable).set({ imageUrl }).where(eq(adsTable.id, id));
      } else {
        const extras: (string | null)[] = Array.isArray(row.extraImages) ? [...(row.extraImages as string[])] : [];
        while (extras.length < slot) extras.push(null);
        extras[slot - 1] = imageUrl;
        await db.update(adsTable).set({ extraImages: extras.filter(Boolean) as string[] }).where(eq(adsTable.id, id));
      }
      req.log.info({ id, imageUrl, slot }, "광고 이미지 업로드 완료");
      return res.json({ success: true, imageUrl, slot });
    } catch (e) {
      req.log.error({ e }, "광고 이미지 업로드 후 저장 실패");
      return res.status(500).json({ success: false, error: "저장 실패" });
    }
  });
});

export default router;
