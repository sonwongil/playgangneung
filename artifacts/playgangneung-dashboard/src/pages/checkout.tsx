import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { loadPaymentWidget, ANONYMOUS, type PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CLIENT_KEY =
  (import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined) ??
  "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eo";

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
  ad_run: "광고집행",
  image_create: "이미지제작",
  coverage: "취재포함",
  etc: "기타",
};

export default function Checkout() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get("productId") ?? "";

  const [products, setProducts] = useState<AdProduct[]>([]);
  const [selectedId, setSelectedId] = useState(preselected);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);

  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const paymentMethodRef = useRef<ReturnType<PaymentWidgetInstance["renderPaymentMethods"]> | null>(null);
  const agreementRef = useRef<ReturnType<PaymentWidgetInstance["renderAgreement"]> | null>(null);

  const product = products.find((p) => p.id === selectedId);

  useEffect(() => {
    fetch(`${BASE}/api/ad-products/public`)
      .then((r) => r.json())
      .then((d: { products: AdProduct[] }) => {
        setProducts(d.products);
        if (!preselected && d.products.length > 0) setSelectedId(d.products[0].id);
      });
  }, []);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;

    async function initWidget() {
      const widget = await loadPaymentWidget(CLIENT_KEY, ANONYMOUS);
      if (cancelled) return;
      widgetRef.current = widget;

      paymentMethodRef.current = widget.renderPaymentMethods(
        "#payment-method",
        { value: product!.amount },
        { variantKey: "DEFAULT" },
      );
      agreementRef.current = widget.renderAgreement(
        "#payment-agreement",
        { variantKey: "AGREEMENT" },
      );
      setWidgetReady(true);
    }

    setWidgetReady(false);
    initWidget().catch(console.error);
    return () => { cancelled = true; };
  }, [product?.id]);

  async function handlePay() {
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
      const { orderId, amount, orderName } = await r.json() as { orderId: string; amount: number; orderName: string };

      const origin = window.location.origin;
      const base = BASE;
      await widgetRef.current.requestPayment({
        orderId,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${origin}${base}/checkout/success`,
        failUrl: `${origin}${base}/checkout/fail`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("USER_CANCEL")) setError(msg);
      setLoading(false);
    }
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

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
                onClick={() => setSelectedId(p.id)}
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

        {/* 토스 결제위젯 */}
        {product && (
          <Card>
            <CardContent className="p-4">
              <div id="payment-method" />
              <div id="payment-agreement" className="mt-2" />
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
        )}

        {/* 결제하기 버튼 */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
          disabled={!product || !widgetReady || loading}
          onClick={handlePay}
        >
          {loading ? "결제 진행 중..." : product ? `₩${product.amount.toLocaleString()} 결제하기` : "상품을 선택해주세요"}
        </Button>

        <p className="text-[10px] text-center text-gray-400">
          결제 금액은 서버에서 최종 검증됩니다.
          <br />테스트 결제 시 실제 금액이 청구되지 않습니다.
        </p>
      </div>
    </div>
  );
}
