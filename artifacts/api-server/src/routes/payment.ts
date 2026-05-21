/**
 * 토스페이먼츠 결제 라우트
 * 참고: https://github.com/tosspayments/tosspayments-sample/tree/main/express-react
 * 공식 샘플 express-react/server.js의 POST /confirm/payment 패턴 적용
 */
import { Router } from "express";
import crypto from "crypto";
import { db, adPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ─── 광고 요금제 목록 (서버 정의) ────────────────────────────────────────────
const PLANS = [
  { id: "basic",   name: "베이직",    amount: 99_000,  description: "기본 노출 (14일)" },
  { id: "main",    name: "메인",      amount: 299_000, description: "메인 노출 (30일)" },
  { id: "premium", name: "프리미엄", amount: 599_000, description: "프리미엄 노출 (60일)" },
] as const;

function basicAuth() {
  const key = process.env["TOSS_SECRET_KEY"] ?? "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

// ─── GET /api/payment/plans — 요금제 목록 (공개) ────────────────────────────
router.get("/payment/plans", (_req, res) => {
  res.json({ plans: [...PLANS] });
});

// ─── POST /api/payment/prepare — 결제 준비 (공개) ───────────────────────────
// 클라이언트 결제 시작 전 orderId·amount를 DB에 선저장 (서버 금액 기준)
router.post("/payment/prepare", async (req, res) => {
  const { plan, customerName, customerEmail, adId } = req.body as {
    plan: string; customerName?: string; customerEmail?: string; adId?: string;
  };
  const planDef = PLANS.find((p) => p.id === plan);
  if (!planDef) return res.status(400).json({ error: "유효하지 않은 요금제입니다." });

  const orderId = "PLAY-" + crypto.randomBytes(8).toString("hex").toUpperCase();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  await db.insert(adPaymentsTable).values({
    id,
    orderId,
    adId: adId ?? null,
    plan: planDef.id,
    amount: planDef.amount,
    customerName: customerName ?? "",
    customerEmail: customerEmail ?? "",
    status: "pending",
  });

  return res.json({ orderId, amount: planDef.amount, orderName: planDef.name });
});

// ─── POST /api/payment/confirm — 결제 승인 (공개) ────────────────────────────
// 토스페이먼츠 공식 샘플 express-react/server.js POST /confirm/payment 패턴 그대로 적용
// 서버에서 DB amount 검증 후 토스 confirm API 호출
router.post("/payment/confirm", async (req, res) => {
  const { paymentKey, orderId, amount } = req.body as {
    paymentKey: string; orderId: string; amount: number;
  };

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: "paymentKey, orderId, amount는 필수입니다." });
  }

  // 서버에서 금액 검증 — DB에 저장된 금액과 불일치 시 거부
  const [record] = await db.select().from(adPaymentsTable).where(eq(adPaymentsTable.orderId, orderId));
  if (!record) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
  if (record.status === "paid") return res.status(409).json({ error: "이미 완료된 결제입니다." });
  if (record.amount !== amount) {
    return res.status(400).json({
      error: `결제 금액이 일치하지 않습니다. (요청: ${amount}원, 기준: ${record.amount}원)`,
    });
  }

  // 토스페이먼츠 결제 승인 API 호출
  // @docs https://docs.tosspayments.com/guides/v2/payment-widget/integration#3-결제-승인하기
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amount, paymentKey }),
  });
  const result = await tossRes.json() as Record<string, unknown>;

  if (!tossRes.ok) {
    await db.update(adPaymentsTable)
      .set({ status: "failed", rawResponse: result })
      .where(eq(adPaymentsTable.orderId, orderId));
    return res.status(tossRes.status).json(result);
  }

  await db.update(adPaymentsTable).set({
    status: "paid",
    paymentKey,
    method: (result["method"] as string) ?? null,
    receiptUrl: ((result["receipt"] as { url?: string } | undefined)?.url) ?? null,
    rawResponse: result,
    paidAt: new Date(),
  }).where(eq(adPaymentsTable.orderId, orderId));

  return res.json({ success: true, orderId, amount, method: result["method"] });
});

// ─── GET /api/payment/orders — 결제 내역 (관리자 전용) ───────────────────────
router.get("/payment/orders", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const rows = await db
    .select()
    .from(adPaymentsTable)
    .orderBy(adPaymentsTable.createdAt);

  return res.json({ orders: rows.reverse() });
});

export default router;
