import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, MousePointerClick, TrendingUp, CircleDollarSign, BarChart2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DailyChartPoint {
  date: string;
  impressions: number;
  clicks: number;
}

interface PublicReportData {
  adTitle: string;
  businessName: string;
  status: string;
  since: string;
  until: string;
  performance: {
    totalImpressions: number;
    totalClicks: number;
    totalSpend: number;
    ctr: number;
    budgetUsedPct?: number;
    totalBudget?: number;
  };
  hasSufficientData: boolean;
  dailyChart?: DailyChartPoint[];
}

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: "심사 중",   cls: "bg-yellow-100 text-yellow-800" },
    approved:  { label: "승인됨",    cls: "bg-blue-100 text-blue-800" },
    scheduled: { label: "게재 예정", cls: "bg-indigo-100 text-indigo-800" },
    published: { label: "게재 중",   cls: "bg-green-100 text-green-800" },
    rejected:  { label: "거절됨",    cls: "bg-red-100 text-red-800" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function shortDate(d: string) {
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return d;
}

export default function AdReport() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<PublicReportData>({
    queryKey: ["public-report", token],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/public/report/${token}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data) {
      document.title = `${data.businessName} 광고 성과 리포트 — PLAY강릉`;
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 px-4">
        <BarChart2 className="w-12 h-12 text-gray-300" />
        <p className="text-base font-medium text-gray-600">리포트를 찾을 수 없습니다</p>
        <p className="text-sm text-gray-400 text-center">링크가 만료되었거나 잘못된 URL입니다.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-2 text-sm text-blue-600 underline underline-offset-2"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const p = data.performance;
  const dateRange = `${data.since} ~ ${data.until}`;
  const chartData = (data.dailyChart ?? []).map((d) => ({ ...d, date: shortDate(d.date) }));
  const hasChart = chartData.length > 0;

  const metrics = [
    {
      label: "총 노출수",
      value: fmt(p.totalImpressions),
      sub: "impressions",
      icon: <Eye className="w-5 h-5 text-blue-500" />,
      color: "bg-blue-50 border-blue-100",
    },
    {
      label: "총 클릭수",
      value: fmt(p.totalClicks),
      sub: "clicks",
      icon: <MousePointerClick className="w-5 h-5 text-green-500" />,
      color: "bg-green-50 border-green-100",
    },
    {
      label: "클릭률 (CTR)",
      value: `${p.ctr.toFixed(2)}%`,
      sub: "click-through rate",
      icon: <TrendingUp className="w-5 h-5 text-purple-500" />,
      color: "bg-purple-50 border-purple-100",
    },
    {
      label: "소진 예산",
      value: `₩${fmt(p.totalSpend)}`,
      sub: p.totalBudget ? `총 예산 ₩${fmt(p.totalBudget)}` : "spend",
      icon: <CircleDollarSign className="w-5 h-5 text-orange-500" />,
      color: "bg-orange-50 border-orange-100",
    },
  ];

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
          <span className="text-xs text-gray-400">광고 성과 리포트</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        {/* 광고 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">광고주</p>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-lg font-bold text-gray-900 leading-tight">{data.businessName}</p>
          {data.adTitle && data.adTitle !== data.businessName && (
            <p className="text-sm text-gray-500">{data.adTitle}</p>
          )}
          <p className="text-xs text-gray-400 pt-1">조회 기간: {dateRange}</p>
        </div>

        {/* 성과 카드 */}
        {!data.hasSufficientData ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-2">
            <BarChart2 className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">아직 성과 데이터가 없습니다.</p>
            <p className="text-xs text-gray-400">광고가 게재되면 성과가 반영됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <Card key={m.label} className={`border ${m.color}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    {m.icon}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{m.value}</p>
                  <p className="text-xs text-gray-500">{m.label}</p>
                  {m.sub && <p className="text-[10px] text-gray-400">{m.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 예산 소진율 바 */}
        {data.hasSufficientData && typeof p.budgetUsedPct === "number" && p.totalBudget && p.totalBudget > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">예산 소진율</p>
              <p className="text-sm font-bold text-orange-600">{p.budgetUsedPct.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, p.budgetUsedPct)}%`,
                  background: p.budgetUsedPct >= 90 ? "#ef4444" : p.budgetUsedPct >= 70 ? "#f97316" : "#22c55e",
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              ₩{fmt(p.totalSpend)} / ₩{fmt(p.totalBudget)} 소진
            </p>
          </div>
        )}

        {/* 일별 성과 차트 */}
        {hasChart && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">일별 성과 추이</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  formatter={(value: number, name: string) => [
                    fmt(value),
                    name === "impressions" ? "노출수" : "클릭수",
                  ]}
                  labelFormatter={(label: string) => `날짜: ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) => value === "impressions" ? "노출수" : "클릭수"}
                />
                <Line
                  type="monotone"
                  dataKey="impressions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="clicks"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          PLAY강릉 광고 성과 리포트 · 데이터는 주기적으로 업데이트됩니다
        </p>
      </main>
    </div>
  );
}
