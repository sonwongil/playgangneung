import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutFail() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const code    = params.get("code") ?? "";
  const message = params.get("message") ?? "결제에 실패했습니다.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <XCircle className="w-14 h-14 text-red-400" />
      <p className="text-xl font-bold text-red-700">결제 실패</p>
      <div className="bg-white border rounded-xl p-5 w-full max-w-sm space-y-2 shadow-sm">
        <p className="text-sm text-gray-600 text-center">{message}</p>
        {code && (
          <p className="text-xs text-gray-400 text-center font-mono">코드: {code}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>홈으로</Button>
        <Button size="sm" onClick={() => navigate("/checkout")} className="bg-blue-600 hover:bg-blue-700 text-white">
          다시 시도
        </Button>
      </div>
    </div>
  );
}
