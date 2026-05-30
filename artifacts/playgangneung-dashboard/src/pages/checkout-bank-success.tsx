import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Clock, Copy, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckoutBankSuccess() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const orderId    = params.get("orderId") ?? "";
  const depositName = params.get("depositName") ?? "";
  const amount     = Number(params.get("amount") ?? "0");

  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  useEffect(() => {
    if (!orderId) navigate(`${BASE}/checkout`);
  }, [orderId]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <button
          onClick={() => navigate("/")}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" />홈으로
        </button>

        {/* 완료 헤더 */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-green-800">입금 신청이 완료됐어요!</h1>
            <p className="text-sm text-green-700">
              아래 안내대로 입금하시면 관리자 확인 후 광고가 승인됩니다.
            </p>
          </CardContent>
        </Card>

        {/* 대기 안내 */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">입금 확인까지 최대 1 영업일</p>
              <p className="text-xs text-amber-700 mt-0.5">
                입금 확인 후 카카오톡 또는 이메일로 안내드립니다.
                문의: play@gangneung.kr
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 입금 정보 */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-800">입금 정보 (다시 확인)</p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">은행</span>
                <span className="font-medium text-gray-800">신한은행</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">계좌번호</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">110-333-486550</span>
                  <button
                    onClick={() => copy("110-333-486550", "account")}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copied === "account" && <span className="text-xs text-blue-500">복사됨!</span>}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">예금주</span>
                <span className="font-medium text-gray-800">손원길</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">입금금액</span>
                <span className="font-bold text-blue-700">₩{amount.toLocaleString()}</span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">입금자명</span>
                  <span className="font-bold text-gray-800">{depositName}</span>
                </div>
                <p className="text-xs text-blue-600 mt-1.5 text-right">
                  광고 신청 시 입력한 이름으로 입금해 주세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 주문번호 */}
        <p className="text-center text-xs text-gray-400">주문번호: {orderId}</p>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/")}
        >
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
