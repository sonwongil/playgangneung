import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get("paymentKey") ?? "";
  const orderId    = params.get("orderId") ?? "";
  const amount     = Number(params.get("amount") ?? "0");

  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [method, setMethod] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setState("error"); setErrorMsg("결제 정보가 올바르지 않습니다."); return;
    }

    fetch(`${BASE}/api/payment/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (r) => {
        const d = await r.json() as { success?: boolean; method?: string; message?: string; code?: string };
        if (!r.ok) { setState("error"); setErrorMsg(d.message ?? d.code ?? "결제 승인 실패"); }
        else { setState("ok"); setMethod(d.method ?? ""); }
      })
      .catch(() => { setState("error"); setErrorMsg("서버 오류가 발생했습니다."); });
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">결제 승인 중...</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <XCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-bold text-red-700">결제 승인 실패</p>
        <p className="text-sm text-gray-500 text-center">{errorMsg}</p>
        <Button variant="outline" onClick={() => navigate("/checkout")}>다시 시도</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <CheckCircle className="w-14 h-14 text-green-500" />
      <p className="text-xl font-bold text-gray-900">결제 완료!</p>
      <div className="bg-white border rounded-xl p-5 w-full max-w-sm space-y-2 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">주문번호</span>
          <span className="font-mono text-xs text-gray-700">{orderId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">결제 금액</span>
          <span className="font-bold">₩{amount.toLocaleString()}</span>
        </div>
        {method && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">결제 수단</span>
            <span>{method}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">
        광고 접수 후 관리자 검토가 완료되면<br/>알림을 드립니다.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>홈으로</Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/my-ad")}>내 광고 확인</Button>
      </div>
    </div>
  );
}
