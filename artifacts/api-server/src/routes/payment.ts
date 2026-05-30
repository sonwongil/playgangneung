/**
 * 토스페이먼츠 결제 라우트
 * 참고: https://github.com/tosspayments/tosspayments-sample/tree/main/express-react
 * 공식 샘플 express-react/server.js의 POST /confirm/payment 패턴 적용
 *
 * 상품 가격은 productId 기준으로 DB에서 조회 — 프론트 전달 금액 신뢰 안 함
 * 결제 시점의 상품명·가격·마진율 등을 snapshot으로 주문에 복사 저장
 *
 * [보안] 레이스 컨디션 방어 (CAS 패턴):
 *   confirm 엔드포인트는 SELECT-check-UPDATE 패턴 대신
 *   UPDATE WHERE status='pending' 원자적 전환으로 중복 처리를 방지한다.
 *   동시 요청이 와도 DB 레벨에서 한 요청만 통과하므로 광고 중복 생성 불가.
 */
import { Router } from "express";
import crypto from "crypto";
import { db, adPaymentsTable, adProductsTable, adsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  sendMail,
  sendSms,
  buildPaymentReceiptHtml,
  buildPaymentReceiptSms,
  isMailConfigured,
  isSmsConfigured,
} from "../lib/mailer.js";

const router = Router();

/**
 * 토스 시크릿 키 반환.
 * [보안] TOSS_SECRET_KEY 는 서버 환경변수에서만 읽는다.
 * 프로덕션에서 미설정 시 stderr 경고 — 실결제 전 Secrets 등록 필수.
 */
function basicAuth() {
  const key = process.env["TOSS_SECRET_KEY"];
  if (!key && process.env["NODE_ENV"] === "production") {
    process.stderr.write("[payment] ⚠️  TOSS_SECRET_KEY 미설정 — 실결제 불가\n");
  }
  return "Basic " + Buffer.from((key ?? "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R") + ":").toString("base64");
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
// 서버에서 DB amount 검증 후 토스 승인 API 호출
//
// [보안] CAS(Compare-And-Swap) 레이스 컨디션 방어:
//   - SELECT → check → Toss API → UPDATE 사이 동시 요청이 오면 두 번 모두 check를
//     통과할 수 있는 TOCTOU 취약점 존재.
//   - 먼저 UPDATE WHERE status='pending' SET status='confirming' 을 원자적으로 실행.
//     업데이트된 행이 0개면 다른 요청이 이미 처리 중 또는 완료 → 즉시 409 반환.
//     PostgreSQL UPDATE는 row-level 락을 획득하므로 동시 요청 중 1개만 통과.
router.post("/payment/confirm", async (req, res) => {
  const { paymentKey, orderId, amount } = req.body as {
    paymentKey: string; orderId: string; amount: number;
  };

  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: "paymentKey, orderId, amount는 필수입니다." });
  }

  // ── CAS: pending → confirming 원자적 전환 ────────────────────────────────
  // .returning() 으로 업데이트된 행 전체를 한 번에 가져온다 (SELECT 불필요)
  const claimed = await db
    .update(adPaymentsTable)
    .set({ status: "confirming" })
    .where(and(
      eq(adPaymentsTable.orderId, orderId),
      inArray(adPaymentsTable.status, ["pending"]),
    ))
    .returning();

  if (claimed.length === 0) {
    // 이미 처리 중이거나 완료/실패된 주문 — 상태 재조회 후 적절한 응답
    const [existing] = await db
      .select({ status: adPaymentsTable.status })
      .from(adPaymentsTable)
      .where(eq(adPaymentsTable.orderId, orderId));

    if (!existing) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    if (existing.status === "paid") return res.status(409).json({ error: "이미 완료된 결제입니다." });
    if (existing.status === "confirming") return res.status(409).json({ error: "결제 처리 중입니다. 잠시 후 확인해주세요." });
    return res.status(409).json({ error: "처리할 수 없는 주문 상태입니다." });
  }

  const record = claimed[0]!;

  // ── 금액 위변조 방어: DB 저장 금액과 successUrl 파라미터 amount 반드시 일치 ──
  if (record.amount !== amount) {
    // 잘못된 금액 → 상태 복구 후 거부 (CAS 롤백)
    await db
      .update(adPaymentsTable)
      .set({ status: "pending" })
      .where(eq(adPaymentsTable.orderId, orderId));
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
    await db
      .update(adPaymentsTable)
      .set({ status: "failed", rawResponse: result })
      .where(eq(adPaymentsTable.orderId, orderId));
    // [보안] 토스 내부 에러 원문 대신 code·message 만 반환 — 민감 정보 노출 방지
    return res.status(tossRes.status).json({
      code: (result["code"] as string) ?? "TOSS_ERROR",
      error: (result["message"] as string) ?? "결제 승인에 실패했습니다.",
    });
  }

  const paidAt = new Date();
  const method = (result["method"] as string) ?? null;
  const receiptUrl = ((result["receipt"] as { url?: string } | undefined)?.url) ?? null;

  // ── 광고 신청 자동 생성 ────────────────────────────────────────────────────
  // CAS 잠금으로 이 블록은 단 1개의 요청만 실행 가능 → 중복 생성 원천 차단
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

  // ── 결제 완료 이메일 / SMS 발송 ────────────────────────────────────────────
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
