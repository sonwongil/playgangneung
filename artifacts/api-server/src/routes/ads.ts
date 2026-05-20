import { Router } from "express";
import crypto from "crypto";
import { db, adsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

export type AdStatus = "pending" | "approved" | "scheduled" | "published" | "rejected";
export type AdPlan = "basic" | "main" | "premium";

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
  plan: AdPlan;
  status: AdStatus;
  source: "광고접수";
  createdAt: string;
  approvedAt?: string;
  isFreeAd: true;
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
    plan: (row.plan as AdPlan) ?? "basic",
    status: (row.status as AdStatus) ?? "pending",
    source: "광고접수",
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    isFreeAd: true,
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

export default router;
