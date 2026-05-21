/**
 * 토스페이먼츠 결제 라우트
 * 참고: https://github.com/tosspayments/tosspayments-sample/tree/main/express-react
 * 공식 샘플 express-react/server.js의 POST /confirm/payment 패턴 적용
 *
 * 상품 가격은 productId 기준으로 DB에서 조회 — 프론트 전달 금액 신뢰 안 함
 * 결제 시점의 상품명·가격·마진율 등을 snapshot으로 주문에 복사 저장
 */
import { Router } from "express";
import crypto from "crypto";
import { db, adPaymentsTable, adProductsTable, adsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  sendMail,
  sendSms,
  buildPaymentReceiptHtml,
  buildPaymentReceiptSms,
  isMailConfigured,
  isSmsConfigured,
} from "../lib/mailer.js";

const router = Router();

function basicAuth() {
  const key = process.env["TOSS_SECRET_KEY"] ?? "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

// ─── POST /api/payment/prepare — 결제 준비 ───────────────────────────────────
// productId 로 DB에서 상품 조회 → orderId + 서버 금액 반환, snapshot 저장
router.post("/payment/prepare", async (req, res) => {
  const { productId, customerName, customerEmail, adId } = req.body as {
    productId?: string;
    customerName?: string;
    customerEmail?: string;
    adId?: string;
  };

  if (!productId) return res.status(400).json({ error: "productId는 필수입니다." });

  const [product] = await db
    .select()
    .from(adProductsTable)
    .where(eq(adProductsTable.id, productId));

  if (!product) return res.status(404).json({ error: "존재하지 않는 상품입니다." });
  if (!product.isActive) return res.status(400).json({ error: "현재 판매 중이지 않은 상품입니다." });

  const orderId = "PLAY-" + crypto.randomBytes(8).toString("hex").toUpperCase();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  const margin = Math.round(product.amount * product.marginRate);
  const adExecution = product.amount - margin;

  await db.insert(adPaymentsTable).values({
    id,
    orderId,
    adId: adId ?? null,
    productId: product.id,
    productNameSnapshot: product.name,
    productPriceSnapshot: product.amount,
    marginRateSnapshot: product.marginRate,
    adDurationDaysSnapshot: product.adDurationDays ?? null,
    productTypeSnapshot: product.productType,
    plan: product.name,
    amount: product.amount,
    customerName: customerName ?? "",
    customerEmail: customerEmail ?? "",
    status: "pending",
  });

  return res.json({
    orderId,
    amount: product.amount,
    orderName: product.name,
    margin,
    adExecution,
  });
});

// ─── POST /api/payment/confirm — 결제 승인 ───────────────────────────────────
// 토스페이먼츠 공식 샘플 express-react/server.js POST /confirm/payment 패턴 그대로 적용
// 서버에서 DB amount 검증 후 토스 confirm API 호출
router.post("/payment/confirm", async (req, res) => {
  const { paymentKey, orderId, amount } = req.body as {
    paymentKey: string; orderId: string; amount: number;
  };

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: "paymentKey, orderId, amount는 필수입니다." });
  }

  const [record] = await db.select().from(adPaymentsTable).where(eq(adPaymentsTable.orderId, orderId));
  if (!record) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
  if (record.status === "paid") return res.status(409).json({ error: "이미 완료된 결제입니다." });
  if (record.amount !== amount) {
    return res.status(400).json({
      error: `결제 금액이 일치하지 않습니다. (요청: ${amount}원, 기준: ${record.amount}원)`,
    });
  }

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

  const paidAt = new Date();
  const method = (result["method"] as string) ?? null;
  const receiptUrl = ((result["receipt"] as { url?: string } | undefined)?.url) ?? null;

  // ── T004: 광고 신청 자동 생성 ──────────────────────────────────────────────
  let newAdId: string | null = null;
  if (!record.adId) {
    newAdId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    try {
      await db.insert(adsTable).values({
        id: newAdId,
        businessName: record.customerName || "미입력",
        contactName: record.customerName || "미입력",
        phone: "",
        email: record.customerEmail || "",
        category: "기타",
        title: record.productNameSnapshot ?? record.plan ?? "광고 신청",
        description: "",
        date: "",
        location: "",
        url: "",
        plan: record.productTypeSnapshot ?? "ad_run",
        status: "pending",
        isFreeAd: false,
      });
    } catch {
      newAdId = null;
    }
  }

  await db.update(adPaymentsTable).set({
    status: "paid",
    paymentKey,
    method,
    receiptUrl,
    rawResponse: result,
    paidAt,
    ...(newAdId ? { adId: newAdId } : {}),
  }).where(eq(adPaymentsTable.orderId, orderId));

  // ── T003: 결제 완료 이메일 / SMS 발송 ──────────────────────────────────────
  if (record.customerEmail) {
    const paidAtStr = paidAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    if (isMailConfigured()) {
      await sendMail({
        to: record.customerEmail,
        subject: `[PLAY강릉] 결제 완료 — ${record.productNameSnapshot ?? record.plan}`,
        html: buildPaymentReceiptHtml({
          customerName: record.customerName || "고객",
          productName: record.productNameSnapshot ?? record.plan ?? "광고 상품",
          amount: record.amount,
          orderId: record.orderId,
          method,
          paidAt: paidAtStr,
        }),
      });
    }

    if (isSmsConfigured() && (result["cardNumber"] == null)) {
      // 가상계좌/무통장 입금 완료 시 SMS 추가 발송 (카드는 앱 알림으로 충분)
    }
  }

  // 관리자 SMS 알림 (SMS 설정 있을 때만)
  if (isSmsConfigured() && process.env["ADMIN_PHONE"]) {
    await sendSms(
      process.env["ADMIN_PHONE"],
      buildPaymentReceiptSms({
        customerName: record.customerName || "고객",
        productName: record.productNameSnapshot ?? record.plan ?? "광고 상품",
        amount: record.amount,
        orderId: record.orderId,
      }),
    );
  }

  return res.json({ success: true, orderId, amount, method });
});

// ─── POST /api/payment/:orderId/refund — 환불 처리 (관리자 전용) ──────────────
router.post("/payment/:orderId/refund", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const { orderId } = req.params as { orderId: string };
  const { cancelReason = "관리자 환불 처리" } = req.body as { cancelReason?: string };

  const [record] = await db.select().from(adPaymentsTable).where(eq(adPaymentsTable.orderId, orderId));
  if (!record) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
  if (record.status !== "paid") return res.status(400).json({ error: "결제 완료 상태에서만 환불 가능합니다." });
  if (!record.paymentKey) return res.status(400).json({ error: "결제키가 없습니다. 테스트 결제는 콘솔에서 직접 취소하세요." });

  const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${record.paymentKey}/cancel`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ cancelReason, cancelAmount: record.amount }),
  });
  const result = await tossRes.json() as Record<string, unknown>;

  if (!tossRes.ok) {
    return res.status(tossRes.status).json({ error: (result["message"] as string) ?? "토스 환불 API 오류" });
  }

  await db.update(adPaymentsTable)
    .set({ status: "refunded", rawResponse: result })
    .where(eq(adPaymentsTable.orderId, orderId));

  return res.json({ success: true, orderId });
});

// ─── GET /api/payment/orders — 결제 내역 (관리자 전용) ───────────────────────
router.get("/payment/orders", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "로그인이 필요합니다." });

  const rows = await db
    .select()
    .from(adPaymentsTable)
    .orderBy(adPaymentsTable.createdAt);

  return res.json({ orders: [...rows].reverse() });
});

export default router;
