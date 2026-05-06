import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Share2,
  Settings,
  RefreshCw,
  Image,
  MessageSquare,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Menu,
  ExternalLink,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SocialDraft {
  title: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  link: string;
  source: string;
  sourceType: string;
  status: "draft" | "approved" | "rejected";
  socialDraft: SocialDraft | null;
  cardImageUrl: string | null;
  crawledAt: string;
  category?: string;
  thumbnail?: string;
}

type NavItem = {
  icon: React.ReactNode;
  label: string;
  key: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: <LayoutDashboard className="w-4 h-4" />, label: "대시보드", key: "dashboard" },
  { icon: <CalendarDays className="w-4 h-4" />, label: "행사 관리", key: "events" },
  { icon: <Megaphone className="w-4 h-4" />, label: "광고접수", key: "ads" },
  { icon: <FileText className="w-4 h-4" />, label: "콘텐츠 관리", key: "content" },
  { icon: <Share2 className="w-4 h-4" />, label: "SNS 관리", key: "sns" },
  { icon: <Settings className="w-4 h-4" />, label: "설정", key: "settings" },
];

interface Ad {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  title: string;
  description: string;
  date: string;
  location: string;
  url: string;
  imageUrl: string | null;
  plan: "basic" | "main" | "premium";
  status: "pending" | "approved" | "scheduled" | "published" | "rejected";
  createdAt: string;
}

const PLAN_LABEL: Record<string, string> = { basic: "기본", main: "메인", premium: "프리미엄" };
const PLAN_COLOR: Record<string, string> = { basic: "bg-blue-100 text-blue-700", main: "bg-purple-100 text-purple-700", premium: "bg-orange-100 text-orange-700" };

const AD_STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending:   { label: "접수대기", class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     class: "bg-green-100 text-green-700 border-green-200" },
  scheduled: { label: "발행예정", class: "bg-blue-100 text-blue-700 border-blue-200" },
  published: { label: "발행완료", class: "bg-gray-100 text-gray-700 border-gray-200" },
  rejected:  { label: "제외",     class: "bg-red-100 text-red-700 border-red-200" },
};

const STATUS_CONFIG = {
  draft: { label: "검토 중", icon: <Clock className="w-3 h-3" />, class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved: { label: "승인", icon: <CheckCircle className="w-3 h-3" />, class: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "반려", icon: <XCircle className="w-3 h-3" />, class: "bg-red-100 text-red-700 border-red-200" },
};

const MOCK_EVENTS: Event[] = [
  {
    id: "1", title: "2026 강릉 커피축제", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제.", date: "2026-05-10", link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "rss", status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-06T09:00:00.000Z", category: "행사",
  },
  {
    id: "2", title: "안목해변 카페거리 맛집 탐방", description: "강릉 안목해변을 따라 즐비한 개성 넘치는 카페와 식당들.", date: "2026-05-08", link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "html", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-06T08:30:00.000Z", category: "맛집",
  },
  {
    id: "3", title: "경포해변 일출 명소", description: "강릉 경포해변에서 바라보는 아름다운 일출.", date: "2026-05-06", link: "https://www.gangneung.go.kr", source: "PLAY강릉", sourceType: "manual", status: "approved", socialDraft: { title: "경포해변 일출 명소", caption: "강릉 경포해변에서 일출 명소를 소개합니다! 🌅", hashtags: ["강릉", "경포해변", "일출", "핫플"], createdAt: "2026-05-05T20:00:00.000Z" }, cardImageUrl: null, crawledAt: "2026-05-05T20:00:00.000Z", category: "핫플",
  },
  {
    id: "4", title: "강릉 단오제 준비 위원회 출범", description: "유네스코 무형문화유산에 등재된 강릉단오제의 2026년 행사 준비 시작.", date: "2026-05-01", link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "rss", status: "rejected", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-01T10:00:00.000Z", category: "지역소식",
  },
  {
    id: "5", title: "강릉 초당 순두부 골목", description: "강릉의 대표 향토음식, 초당 순두부.", date: "2026-05-03", link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "html", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: "2026-05-03T11:00:00.000Z", category: "맛집",
  },
];

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ events: Event[]; total: number }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/events`);
      if (!res.ok) throw new Error("이벤트 로드 실패");
      return res.json();
    },
  });

  const { data: adsData, isLoading: adsLoading } = useQuery<{ ads: Ad[]; total: number }>({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ads`);
      if (!res.ok) throw new Error("광고 로드 실패");
      return res.json();
    },
    enabled: activeNav === "ads",
  });

  const events: Event[] = data?.events?.length ? data.events : MOCK_EVENTS;

  const totalCount = events.length;
  const draftCount = events.filter((e) => e.status === "draft").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = events.filter((e) => e.crawledAt?.startsWith(today)).length;
  const snsReadyCount = events.filter((e) => e.status === "approved" && e.socialDraft).length;

  const crawlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/crawl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) throw new Error("크롤링 실패");
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: "크롤링 완료", description: `${d.added ?? 0}건 추가되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast({ title: "크롤링 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`${BASE}/api/events/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "상태 변경 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const draftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/api/events/${id}/draft`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "초안 생성 실패"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SNS 초안 생성 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "초안 생성 실패", description: e.message, variant: "destructive" }),
  });

  const cardMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/api/events/${id}/card`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "카드 생성 실패"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "카드이미지 생성 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "카드 생성 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const adStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`${BASE}/api/ads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("상태 변경 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "상태 변경 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const adDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/api/ads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "광고 삭제 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
    },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const ads: Ad[] = adsData?.ads ?? [];

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-sidebar text-sidebar-foreground ${mobile ? "w-64" : "w-56"}`}>
      <div className="p-5 border-b border-sidebar-border">
        <img src={`${BASE}/logo.png`} alt="PLAY강릉" className="h-8 object-contain brightness-0 invert" />
        <p className="text-xs text-sidebar-foreground/50 mt-1">관리자 대시보드</p>
      </div>
      <nav className="flex-1 py-4 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => { setActiveNav(item.key); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
              activeNav === item.key
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            {item.icon}
            {item.label}
            {activeNav === item.key && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <a
          href={`${BASE}/`}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          공개 홈페이지 보기
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">
                {NAV_ITEMS.find((n) => n.key === activeNav)?.label ?? "대시보드"}
              </h1>
              <p className="text-xs text-muted-foreground">PLAY강릉 백오피스</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => crawlMutation.mutate()}
              disabled={crawlMutation.isPending}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${crawlMutation.isPending ? "animate-spin" : ""}`} />
              {crawlMutation.isPending ? "크롤링 중..." : "전체 크롤링"}
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5">

          {/* ── 광고접수 섹션 ── */}
          {activeNav === "ads" && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-600" />광고 접수 목록
                </CardTitle>
                <span className="text-xs text-muted-foreground">{ads.length}건</span>
              </CardHeader>
              <CardContent className="p-0">
                {adsLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중...</div>
                ) : ads.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    접수된 광고가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 text-xs">
                          <TableHead className="w-24">상태</TableHead>
                          <TableHead className="w-20">상품</TableHead>
                          <TableHead>제목 / 업체명</TableHead>
                          <TableHead className="w-32 hidden md:table-cell">연락처</TableHead>
                          <TableHead className="w-24 hidden lg:table-cell">등록일</TableHead>
                          <TableHead className="w-48 text-right">액션</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ads.map((ad) => {
                          const sc = AD_STATUS_CONFIG[ad.status] ?? AD_STATUS_CONFIG.pending;
                          return (
                            <TableRow key={ad.id} className="text-sm hover:bg-gray-50/50">
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${sc.class}`}>
                                  {sc.label}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLOR[ad.plan]}`}>
                                  {PLAN_LABEL[ad.plan]}
                                </span>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium line-clamp-1 max-w-[180px]">{ad.title}</p>
                                <p className="text-xs text-muted-foreground">{ad.businessName} · {ad.category}</p>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{ad.phone}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                {ad.createdAt?.slice(0, 10)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 justify-end flex-wrap">
                                  {ad.status === "pending" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                      onClick={() => adStatusMutation.mutate({ id: ad.id, status: "approved" })}
                                      disabled={adStatusMutation.isPending}>
                                      <CheckCircle className="w-3 h-3" /> 승인
                                    </Button>
                                  )}
                                  {ad.status === "approved" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                                      onClick={() => adStatusMutation.mutate({ id: ad.id, status: "scheduled" })}
                                      disabled={adStatusMutation.isPending}>
                                      SNS발행예정
                                    </Button>
                                  )}
                                  {ad.status === "scheduled" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-gray-700 border-gray-200 hover:bg-gray-50"
                                      onClick={() => adStatusMutation.mutate({ id: ad.id, status: "published" })}
                                      disabled={adStatusMutation.isPending}>
                                      발행완료
                                    </Button>
                                  )}
                                  {ad.status !== "rejected" && ad.status !== "published" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                      onClick={() => adStatusMutation.mutate({ id: ad.id, status: "rejected" })}
                                      disabled={adStatusMutation.isPending}>
                                      <XCircle className="w-3 h-3" /> 제외
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => adDeleteMutation.mutate(ad.id)}
                                    disabled={adDeleteMutation.isPending}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 대시보드/기타 섹션 ── */}
          {activeNav !== "ads" && <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="전체 콘텐츠" value={totalCount} sub="수집된 항목 수" color="text-blue-600" />
            <StatCard label="승인대기" value={draftCount} sub="검토가 필요한 항목" color="text-yellow-600" />
            <StatCard label="오늘수집" value={todayCount} sub="오늘 새로 수집된 항목" color="text-green-600" />
            <StatCard label="SNS발행예정" value={snsReadyCount} sub="초안 완성·발행 대기" color="text-purple-600" />
          </div>

          {/* Event Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">수집 이벤트 목록</CardTitle>
              <span className="text-xs text-muted-foreground">{totalCount}건</span>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">불러오는 중...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 text-xs">
                        <TableHead className="w-24">상태</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className="w-28 hidden sm:table-cell">날짜</TableHead>
                        <TableHead className="w-28 hidden md:table-cell">출처</TableHead>
                        <TableHead className="w-24 hidden lg:table-cell">카테고리</TableHead>
                        <TableHead className="w-48 text-right">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => {
                        const sc = STATUS_CONFIG[event.status];
                        return (
                          <TableRow key={event.id} className="text-sm hover:bg-gray-50/50">
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.class}`}>
                                {sc.icon}
                                {sc.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium line-clamp-1 max-w-[200px]">{event.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{event.description}</p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{event.date}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{event.source}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {event.category && (
                                <Badge variant="outline" className="text-xs">{event.category}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 justify-end flex-wrap">
                                {event.status === "draft" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                      onClick={() => statusMutation.mutate({ id: event.id, status: "approved" })}
                                      disabled={statusMutation.isPending}
                                    >
                                      <CheckCircle className="w-3 h-3" /> 승인
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50"
                                      onClick={() => statusMutation.mutate({ id: event.id, status: "rejected" })}
                                      disabled={statusMutation.isPending}
                                    >
                                      <XCircle className="w-3 h-3" /> 반려
                                    </Button>
                                  </>
                                )}
                                {event.status === "approved" && !event.socialDraft && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => draftMutation.mutate(event.id)}
                                    disabled={draftMutation.isPending}
                                  >
                                    <MessageSquare className="w-3 h-3" /> SNS초안
                                  </Button>
                                )}
                                {event.status === "approved" && event.socialDraft && !event.cardImageUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => cardMutation.mutate(event.id)}
                                    disabled={cardMutation.isPending}
                                  >
                                    <Image className="w-3 h-3" /> 카드생성
                                  </Button>
                                )}
                                {event.cardImageUrl && (
                                  <a href={event.cardImageUrl} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-700 border-blue-200">
                                      <Image className="w-3 h-3" /> 카드보기
                                    </Button>
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteMutation.mutate(event.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          </>}
        </main>
      </div>
    </div>
  );
}
