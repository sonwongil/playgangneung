import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import QRCode from "qrcode";
import { Copy, CheckCircle2, Banknote, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// 계좌이체 은행 정보 (환경 하드코딩)
const BANK_NAME    = "신한은행";
const BANK_ACCOUNT = "110-333-486550";
const BANK_HOLDER  = "손원길";

// 토스 결제 활성화 여부 — VITE_ENABLE_TOSS_PAYMENT=true 일 때만 카드 결제 사용
const TOSS_ENABLED = import.meta.env.VITE_ENABLE_TOSS_PAYMENT === "true";

// [보안] 토스 활성화 시에만 키 검증
const _RAW_CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined;
const _isKeyInvalid =
  !TOSS_ENABLED ||
  !_RAW_CLIENT_KEY ||
  (import.meta.env.PROD && _RAW_CLIENT_KEY.startsWith("test_ck_"));
const CLIENT_KEY = _RAW_CLIENT_KEY ?? "";

type PaymentMethod = "bank_transfer" | "card";
type Step = "form" | "bank_info";

interface AdProduct {
  id: string;
  name: string;
  description: string;
  amount: number;
  adDurationDays: number | null;
  productType: string;
  sortOrder: number;
}

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  ad_run:       "광고집행",
  image_create: "이미지제작",
  coverage:     "취재포함",
  etc:          "기타",
};

export default function Checkout() {
  const [, navigate] = useLocation();

  const params      = new URLSearchParams(window.location.search);
  const preselected = params.get("productId") ?? "";

  const [products, setProducts]         = useState<AdProduct[]>([]);
  const [selectedId, setSelectedId]     = useState(preselected);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [step, setStep]                 = useState<Step>("form");

  // 계좌이체 상태
  const [orderId, setOrderId]           = useState<string>("");
  const [depositName, setDepositName]   = useState<string>("");
  const [qrDataUrl, setQrDataUrl]       = useState<string>("");
  const [copied, setCopied]             = useState<string | null>(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);

  // 카드(토스) 상태 — 보류 중
  const [widgetReady, setWidgetReady]   = useState(false);
  const widgetRef = useRef<TossPaymentsWidgets | null>(null);

  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const product = products.find((p) => p.id === selectedId);

  // ── 상품 목록 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/ad-products/public`)
      .then((r) => r.json())
      .then((d: { products: AdProduct[] }) => {
        setProducts(d.products);
        if (!preselected && d.products.length > 0) setSelectedId(d.products[0].id);
      });
  }, []);

  // ── 토스 위젯 초기화 (카드 선택 + TOSS_ENABLED 시만) ─────────────────────
  useEffect(() => {
    if (paymentMethod !== "card" || _isKeyInvalid || !product) return;
    let cancelled = false;

    async function initWidget() {
      const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
      if (cancelled) return;
      const tossPayments = await loadTossPayments(CLIENT_KEY);
      if (cancelled) return;
      const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
      await widgets.setAmount({ currency: "KRW", value: product!.amount });
      if (cancelled) return;
      await widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" });
      await widgets.renderAgreement({ selector: "#payment-agreement", variantKey: "AGREEMENT" });
      if (cancelled) return;
      widgetRef.current = widgets;
      setWidgetReady(true);
    }

    setWidgetReady(false);
    widgetRef.current = null;
    initWidget().catch(console.error);
    return () => { cancelled = true; };
  }, [product?.id, paymentMethod]);

  // ── QR 생성 (계좌이체 bank_info 단계) ─────────────────────────────────────
  useEffect(() => {
    if (step !== "bank_info" || !orderId || !product) return;
    const text = [
      `${BANK_NAME} ${BANK_ACCOUNT}`,
      `예금주: ${BANK_HOLDER}`,
      `입금자명: ${depositName}`,
      `금액: ${product.amount.toLocaleString()}원`,
    ].join("\n");
    QRCode.toDataURL(text, { errorCorrectionLevel: "M", width: 220, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [step, orderId, depositName, product?.amount]);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // ── 계좌이체 신청 — prepare → bank_info 단계로 전환 ──────────────────────
  async function handleBankTransferRequest() {
    if (!product) return;
    if (!customerName.trim()) { setError("이름을 입력해주세요."); return; }
    if (!customerEmail.trim()) { setError("이메일을 입력해주세요."); return; }
    setError(null);
    setLoading(true);

    try {
      const r = await fetch(`${BASE}/api/payment/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, customerName, customerEmail }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "신청 준비 실패");
        return;
      }
      const { orderId: oid } = await r.json() as { orderId: string; amount: number; orderName: string };
      const dName = customerName.trim();
      setOrderId(oid);
      setDepositName(dName);
      setStep("bank_info");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ── "입금했어요" — bank_transfer_requested 상태로 DB 업데이트 → success ───
  async function handleBankTransferSubmit() {
    if (!orderId || !product) return;
    setBankSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/payment/bank-transfer/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, depositName }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "입금 신청 실패");
        return;
      }
      const qs = new URLSearchParams({
        orderId,
        depositName,
        amount: String(product.amount),
      });
      navigate(`/checkout/bank-success?${qs.toString()}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setBankSubmitting(false);
    }
  }

  // ── 카드결제 (토스) ────────────────────────────────────────────────────────
  async function handleCardPay() {
    if (!product || !widgetRef.current) return;
    if (!customerName.trim()) { setError("이름을 입력해주세요."); return; }
    if (!customerEmail.trim()) { setError("이메일을 입력해주세요."); return; }
    setError(null);
    setLoading(true);

    try {
      const r = await fetch(`${BASE}/api/payment/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, customerName, customerEmail }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "결제 준비 실패");
        setLoading(false);
        return;
      }
      const { orderId: oid, amount, orderName } = await r.json() as { orderId: string; amount: number; orderName: string };
      const origin = window.location.origin;
      await widgetRef.current.requestPayment({
        orderId: oid,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${origin}${BASE}/checkout/success`,
        failUrl:    `${origin}${BASE}/checkout/fail`,
      });
      void amount;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("USER_CANCEL")) setError(msg);
      setLoading(false);
    }
  }

  // ── 로딩 상태 (상품 미로드) ────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // bank_info 단계 — 계좌이체 안내 화면
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "bank_info" && paymentMethod === "bank_transfer") {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-lg mx-auto space-y-5">
          <div>
            <button
              onClick={() => setStep("form")}
              className="text-xs text-gray-400 hover:text-gray-600 mb-2 block"
            >
              ← 뒤로
            </button>
            <h1 className="text-xl font-bold text-gray-900">계좌이체 안내</h1>
            <p className="text-sm text-gray-500 mt-1">
              아래 계좌로 입금 후 "입금했어요" 버튼을 눌러주세요.
            </p>
          </div>

          {/* 주문 요약 */}
          <Card className="border-blue-100 bg-blue-50">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-blue-900">{product?.name}</p>
                {product?.adDurationDays && (
                  <p className="text-xs text-blue-600">{product.adDurationDays}일</p>
                )}
              </div>
              <p className="text-xl font-bold text-blue-800">₩{product?.amount.toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* 계좌 정보 */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-green-600" />
                입금 계좌 정보
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">은행</span>
                  <span className="font-medium text-gray-800">{BANK_NAME}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 tabular-nums">{BANK_ACCOUNT}</span>
                    <button
                      onClick={() => copyText(BANK_ACCOUNT, "account")}
                      className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 text-xs"
                    >
                      {copied === "account"
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> 복사됨</>
                        : <><Copy className="w-3.5 h-3.5" /> 복사</>
                      }
                    </button>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">예금주</span>
                  <span className="font-medium text-gray-800">{BANK_HOLDER}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">입금금액</span>
                  <span className="font-bold text-gray-900">₩{product?.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* 입금자명 안내 */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-blue-800">입금자명</p>
                <p className="text-sm text-blue-700">
                  광고 신청 시 입력한 이름으로 입금해 주세요.
                </p>
                <p className="text-base font-bold text-blue-900">{depositName}</p>
              </div>

              {/* QR 코드 */}
              {qrDataUrl && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <img src={qrDataUrl} alt="계좌 안내 QR" className="w-44 h-44 rounded-lg border" />
                  <p className="text-[10px] text-gray-400">QR 코드로 계좌 정보 확인</p>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          {/* 입금했어요 버튼 */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
            disabled={bankSubmitting}
            onClick={handleBankTransferSubmit}
          >
            {bankSubmitting ? "처리 중..." : "✅ 입금했어요"}
          </Button>

          <p className="text-[10px] text-center text-gray-400">
            입금 확인은 영업일 기준 최대 1일 소요됩니다.
            <br />확인 후 카카오톡 또는 이메일로 안내드립니다.
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // form 단계 — 상품 선택 + 구매자 정보 + 결제 방식 선택
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <div>
          <button onClick={() => navigate("/")} className="text-xs text-gray-400 hover:text-gray-600 mb-2 block">
            ← 홈으로
          </button>
          <h1 className="text-xl font-bold text-gray-900">광고 신청</h1>
          <p className="text-sm text-gray-500 mt-1">PLAY강릉 SNS 광고 집행을 신청합니다.</p>
        </div>

        {/* 광고 상품 선택 */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-700 mb-3">상품 선택</p>
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setStep("form"); }}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                  selectedId === p.id
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-100 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {PRODUCT_TYPE_LABEL[p.productType] ?? p.productType}
                      </span>
                      {p.adDurationDays && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                          {p.adDurationDays}일
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                    )}
                  </div>
                  <span className="font-bold text-base text-gray-900 whitespace-nowrap shrink-0">
                    ₩{p.amount.toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* 구매자 정보 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">구매자 정보</p>
            <div>
              <Label className="text-xs text-gray-600">이름</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="홍길동"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">이메일</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="example@email.com"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* 결제 방식 선택 */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">결제 방식</p>
            <div className="grid grid-cols-2 gap-3">
              {/* 계좌이체 */}
              <button
                onClick={() => setPaymentMethod("bank_transfer")}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-4 transition-all ${
                  paymentMethod === "bank_transfer"
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <Banknote className={`w-6 h-6 ${paymentMethod === "bank_transfer" ? "text-green-600" : "text-gray-400"}`} />
                <span className={`text-sm font-semibold ${paymentMethod === "bank_transfer" ? "text-green-700" : "text-gray-600"}`}>
                  계좌이체
                </span>
              </button>

              {/* 카드결제 — 준비중 */}
              <button
                disabled
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-gray-100 bg-gray-50 p-4 opacity-50 cursor-not-allowed"
              >
                <CreditCard className="w-6 h-6 text-gray-300" />
                <span className="text-sm font-semibold text-gray-400">카드결제</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">준비중</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 카드(토스) 위젯 — 보류, 카드 선택 시만 렌더 */}
        {paymentMethod === "card" && product && (
          <Card>
            <CardContent className="p-4">
              {_isKeyInvalid ? (
                <p className="text-xs text-red-600 text-center py-4">카드결제 설정 오류 — 관리자에게 문의하세요.</p>
              ) : (
                <>
                  <div id="payment-method" />
                  <div id="payment-agreement" className="mt-2" />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        {/* 신청하기 버튼 */}
        {paymentMethod === "bank_transfer" ? (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-semibold"
            disabled={!product || loading}
            onClick={handleBankTransferRequest}
          >
            {loading
              ? "준비 중..."
              : product
                ? `₩${product.amount.toLocaleString()} 계좌이체 신청하기`
                : "상품을 선택해주세요"}
          </Button>
        ) : (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
            disabled={!product || !widgetReady || loading}
            onClick={handleCardPay}
          >
            {loading ? "결제 진행 중..." : product ? `₩${product.amount.toLocaleString()} 결제하기` : "상품을 선택해주세요"}
          </Button>
        )}

        <p className="text-[10px] text-center text-gray-400">
          결제 금액은 서버에서 최종 검증됩니다.
        </p>
      </div>
    </div>
  );
}
