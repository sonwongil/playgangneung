/**
 * 광고 상품 관리 라우트
 * GET  /api/ad-products/public          — 활성화 상품 목록 (결제 화면용, 공개)
 * GET  /api/admin/ad-products           — 전체 목록 (관리자)
 * POST /api/admin/ad-products           — 상품 추가 (관리자)
 * PATCH /api/admin/ad-products/:id      — 상품 수정 (관리자)
 * DELETE /api/admin/ad-products/:id     — 상품 삭제 (관리자)
 */
import { Router } from "express";
import crypto from "crypto";
import { db, adProductsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// ─── GET /api/ad-products/public — 활성화 상품 (공개) ────────────────────────
router.get("/ad-products/public", async (_req, res) => {
  const rows = await db
    .select()
    .from(adProductsTable)
    .where(eq(adProductsTable.isActive, true))
    .orderBy(asc(adProductsTable.sortOrder), asc(adProductsTable.createdAt));
  res.json({ products: rows });
});

// ─── GET /api/admin/ad-products — 전체 목록 (관리자) ─────────────────────────
router.get("/admin/ad-products", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });
  const rows = await db
    .select()
    .from(adProductsTable)
    .orderBy(asc(adProductsTable.sortOrder), asc(adProductsTable.createdAt));
  return res.json({ products: rows });
});

// ─── POST /api/admin/ad-products — 상품 추가 (관리자) ────────────────────────
router.post("/admin/ad-products", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const { name, description, amount, adDurationDays, productType, isActive, sortOrder, marginRate } = req.body as {
    name?: string;
    description?: string;
    amount?: number;
    adDurationDays?: number | null;
    productType?: string;
    isActive?: boolean;
    sortOrder?: number;
    marginRate?: number;
  };

  if (!name?.trim()) return res.status(400).json({ error: "상품명은 필수입니다." });
  if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "가격은 0보다 커야 합니다." });

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const now = new Date();

  const [row] = await db.insert(adProductsTable).values({
    id,
    name: name.trim(),
    description: description?.trim() ?? "",
    amount,
    adDurationDays: adDurationDays ?? null,
    productType: productType ?? "etc",
    isActive: isActive !== false,
    sortOrder: sortOrder ?? 0,
    marginRate: typeof marginRate === "number" ? marginRate : 0.3,
    createdAt: now,
    updatedAt: now,
  }).returning();

  return res.status(201).json({ product: row });
});

// ─── PATCH /api/admin/ad-products/:id — 상품 수정 (관리자) ───────────────────
router.patch("/admin/ad-products/:id", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const { id } = req.params as { id: string };
  const { name, description, amount, adDurationDays, productType, isActive, sortOrder, marginRate } = req.body as {
    name?: string;
    description?: string;
    amount?: number;
    adDurationDays?: number | null;
    productType?: string;
    isActive?: boolean;
    sortOrder?: number;
    marginRate?: number;
  };

  const [existing] = await db.select().from(adProductsTable).where(eq(adProductsTable.id, id));
  if (!existing) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

  const updates: Partial<typeof adProductsTable.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (typeof amount === "number") updates.amount = amount;
  if (adDurationDays !== undefined) updates.adDurationDays = adDurationDays;
  if (productType !== undefined) updates.productType = productType;
  if (isActive !== undefined) updates.isActive = isActive;
  if (typeof sortOrder === "number") updates.sortOrder = sortOrder;
  if (typeof marginRate === "number") updates.marginRate = marginRate;

  const [updated] = await db.update(adProductsTable).set(updates).where(eq(adProductsTable.id, id)).returning();
  return res.json({ product: updated });
});

// ─── PATCH /api/admin/ad-products/reorder — 순서 일괄 저장 (관리자) ───────────
router.patch("/admin/ad-products/reorder", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const { order } = req.body as { order?: { id: string; sortOrder: number }[] };
  if (!Array.isArray(order)) return res.status(400).json({ error: "order 배열이 필요합니다." });

  await Promise.all(
    order.map(({ id, sortOrder }) =>
      db.update(adProductsTable)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(adProductsTable.id, id)),
    ),
  );

  return res.json({ success: true });
});

// ─── DELETE /api/admin/ad-products/:id — 상품 삭제 (관리자) ─────────────────
router.delete("/admin/ad-products/:id", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const { id } = req.params as { id: string };
  const [existing] = await db.select().from(adProductsTable).where(eq(adProductsTable.id, id));
  if (!existing) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

  await db.delete(adProductsTable).where(eq(adProductsTable.id, id));
  return res.json({ success: true });
});

export default router;
