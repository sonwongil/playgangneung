import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart2, Search, ChevronRight, Megaphone } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdResult {
  id: string;
  title: string;
  businessName: string;
  status: string;
  plan: string;
  createdAt: string;
  reportToken: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending:   "심사 중",
  approved:  "승인됨",
  scheduled: "게재 예정",
  published: "게재 중",
  rejected:  "거절됨",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  approved:  "bg-blue-100 text-blue-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  published: "bg-green-100 text-green-800",
  rejected:  "bg-red-100 text-red-800",
};

const PLAN_LABEL: Record<string, string> = {
  basic: "기본",
  main: "메인",
  premium: "프리미엄",
};

export default function MyAd() {
  const [, navigate] = useLocation();
  const [inputType, setInputType] = useState<"email" | "phone">("email");
  const [value, setValue] = useState("");
  const [results, setResults] = useState<AdResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const body = inputType === "email" ? { email: value } : { phone: value };
      const res = await fetch(`${BASE}/api/public/lookup-ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { ads?: AdResult[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "조회 실패");
      return d.ads!;
    },
    onSuccess: (ads) => {
      setErrorMsg(null);
      if (ads.length === 1) {
        navigate(`/report/${ads[0].reportToken}`);
      } else {
        setResults(ads);
      }
    },
    onError: (e: Error) => {
      setResults(null);
      setErrorMsg(e.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    lookupMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={`${BASE}/logo2.png`}
              alt="PLAY강릉"
              className="h-7 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <span className="text-xs text-gray-400">내 광고 성과 확인</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* 설명 */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <BarChart2 className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">내 광고 성과 확인</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            광고 접수 시 등록하신 이메일 또는 전화번호를 입력하시면<br />
            광고 성과를 확인할 수 있습니다.
          </p>
        </div>

        {/* 조회 폼 */}
        <Card className="border border-gray-200">
          <CardContent className="p-5 space-y-4">
            {/* 입력 방식 탭 */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => { setInputType("email"); setValue(""); setResults(null); setErrorMsg(null); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputType === "email" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                이메일
              </button>
              <button
                type="button"
                onClick={() => { setInputType("phone"); setValue(""); setResults(null); setErrorMsg(null); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputType === "phone" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                전화번호
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="lookup-input" className="text-sm font-medium">
                  {inputType === "email" ? "이메일 주소" : "전화번호"}
                </Label>
                <Input
                  id="lookup-input"
                  type={inputType === "email" ? "email" : "tel"}
                  placeholder={inputType === "email" ? "example@email.com" : "010-0000-0000"}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setErrorMsg(null); }}
                  autoComplete={inputType === "email" ? "email" : "tel"}
                  className="text-base"
                />
              </div>

              {errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!value.trim() || lookupMutation.isPending}
              >
                {lookupMutation.isPending ? (
                  "조회 중..."
                ) : (
                  <><Search className="w-4 h-4 mr-2" />내 광고 조회</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 결과 목록 (광고가 여러 개일 때) */}
        {results && results.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              {results.length}개의 광고가 확인되었습니다. 조회할 광고를 선택하세요.
            </p>
            {results.map((ad) => (
              <button
                key={ad.id}
                onClick={() => navigate(`/report/${ad.reportToken}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{ad.title || ad.businessName}</p>
                    <p className="text-xs text-gray-500">{ad.businessName}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[ad.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[ad.status] ?? ad.status}
                      </span>
                      <span className="text-[10px] text-gray-400">{PLAN_LABEL[ad.plan] ?? ad.plan} 플랜</span>
                      <span className="text-[10px] text-gray-400">{ad.createdAt?.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          문의: PLAY강릉 광고 담당자에게 연락해 주세요
        </p>
      </main>
    </div>
  );
}
