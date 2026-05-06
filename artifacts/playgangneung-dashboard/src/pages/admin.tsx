import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Pencil,
  CalendarRange,
  LogOut,
  KeyRound,
  Copy,
  Download,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getRelDate(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
const TODAY_STR = getRelDate(0);
const TOMORROW_STR = getRelDate(1);

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
  status: "draft" | "approved" | "rejected" | "published";
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
  { icon: <CalendarRange className="w-4 h-4" />, label: "행사 스케줄", key: "schedule" },
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

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; class: string }> = {
  draft: { label: "검토 중", icon: <Clock className="w-3 h-3" />, class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved: { label: "승인", icon: <CheckCircle className="w-3 h-3" />, class: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "반려", icon: <XCircle className="w-3 h-3" />, class: "bg-red-100 text-red-700 border-red-200" },
  published: { label: "발행완료", icon: <Send className="w-3 h-3" />, class: "bg-blue-100 text-blue-700 border-blue-200" },
};

const MOCK_EVENTS: Event[] = [
  {
    id: "m-today-1", title: "2026 강릉 커피축제 개막식", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제 개막. 다양한 커피 체험과 공연.", date: TODAY_STR, link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "rss", status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "행사",
  },
  {
    id: "m-today-2", title: "경포해변 일출 명소 특별 야간행사", description: "강릉 경포해변에서 바라보는 아름다운 일출과 야간 특별 행사.", date: TODAY_STR, link: "https://www.gangneung.go.kr", source: "PLAY강릉", sourceType: "manual", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "행사",
  },
  {
    id: "m-tomorrow-1", title: "경포해변 모래조각 페스티벌", description: "동해 바다를 배경으로 펼쳐지는 모래조각 예술 축제.", date: TOMORROW_STR, link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "html", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "행사",
  },
  {
    id: "1", title: "2026 강릉 커피축제", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제.", date: getRelDate(4), link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "rss", status: "approved", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "행사",
  },
  {
    id: "2", title: "안목해변 카페거리 맛집 탐방", description: "강릉 안목해변을 따라 즐비한 개성 넘치는 카페와 식당들.", date: getRelDate(2), link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "html", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "맛집",
  },
  {
    id: "3", title: "오죽헌 야간 문화행사", description: "신사임당과 율곡 이이의 생가, 오죽헌에서 진행되는 특별 야간 문화 행사.", date: getRelDate(9), link: "https://www.gangneung.go.kr", source: "강릉문화재단", sourceType: "manual", status: "approved", socialDraft: { title: "오죽헌 야간 문화행사", caption: "오죽헌 야간 문화행사! 🏛️ 강릉의 역사와 문화를 밤에 즐겨보세요.", hashtags: ["강릉", "오죽헌", "야간행사", "행사"], createdAt: new Date().toISOString() }, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "행사",
  },
  {
    id: "4", title: "강릉 단오제 준비 위원회 출범", description: "유네스코 무형문화유산에 등재된 강릉단오제의 2026년 행사 준비 시작.", date: getRelDate(-5), link: "https://www.gangneung.go.kr", source: "강릉시청", sourceType: "rss", status: "rejected", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "지역소식",
  },
  {
    id: "5", title: "강릉 초당 순두부 골목", description: "강릉의 대표 향토음식, 초당 순두부.", date: getRelDate(-3), link: "https://www.gangneung.go.kr", source: "강릉관광공사", sourceType: "html", status: "draft", socialDraft: null, cardImageUrl: null, crawledAt: new Date().toISOString(), category: "맛집",
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
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [scheduleSubTab, setScheduleSubTab] = useState<"오늘" | "내일" | "이번 주">("오늘");
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<Event | null>(null);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("로그아웃 실패");
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
    onError: () => toast({ title: "로그아웃 실패", variant: "destructive" }),
  });

  const changePwMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const res = await fetch(`${BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "비밀번호 변경 실패");
      return d;
    },
    onSuccess: () => {
      toast({ title: "비밀번호가 변경되었습니다" });
      setPwForm({ current: "", next: "", confirm: "" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

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

  const adEditMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Ad> }) => {
      const res = await fetch(`${BASE}/api/ads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("수정 실패");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "광고 수정 완료" });
      queryClient.invalidateQueries({ queryKey: ["admin-ads"] });
      setEditingAd(null);
    },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
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
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <a
          href={`${BASE}/`}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          공개 홈페이지 보기
        </a>
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="w-3 h-3" />
          {logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </div>
  );

  return (
    <>
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
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                    onClick={() => setEditingAd(ad)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
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

          {/* ── 행사 스케줄 섹션 ── */}
          {activeNav === "schedule" && (() => {
            const weekStart = (() => {
              const d = new Date();
              const dow = d.getDay();
              d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
              return d.toISOString().slice(0, 10);
            })();
            const weekEnd = (() => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + 6);
              return d.toISOString().slice(0, 10);
            })();

            const scheduleEvents = events.filter((e) => {
              if (scheduleSubTab === "오늘") return e.date === TODAY_STR;
              if (scheduleSubTab === "내일") return e.date === TOMORROW_STR;
              return e.date >= weekStart && e.date <= weekEnd;
            });

            const subCounts = {
              오늘: events.filter((e) => e.date === TODAY_STR).length,
              내일: events.filter((e) => e.date === TOMORROW_STR).length,
              "이번 주": events.filter((e) => e.date >= weekStart && e.date <= weekEnd).length,
            };

            return (
              <div>
                {/* Sub-tab pills */}
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {(["오늘", "내일", "이번 주"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setScheduleSubTab(tab)}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border
                        ${scheduleSubTab === tab
                          ? "bg-blue-600 text-white border-blue-600 shadow"
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                        }`}
                    >
                      <CalendarRange className="w-3.5 h-3.5" />
                      {tab}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                        ${scheduleSubTab === tab ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
                        {subCounts[tab]}
                      </span>
                    </button>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {scheduleSubTab === "이번 주" ? `${weekStart} ~ ${weekEnd}` : scheduleSubTab === "오늘" ? TODAY_STR : TOMORROW_STR}
                  </span>
                </div>

                {scheduleEvents.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <CalendarRange className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-muted-foreground">해당 일정에 등록된 행사가 없습니다.</p>
                      <p className="text-xs text-muted-foreground mt-1">크롤링 또는 수동 등록으로 행사를 추가하세요.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {scheduleEvents.map((event) => {
                      const sc = STATUS_CONFIG[event.status];
                      const stepDone = {
                        approve: event.status === "approved" || event.status === "rejected",
                        draft: !!event.socialDraft,
                        card: !!event.cardImageUrl,
                      };
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedScheduleEvent(event)}
                          className="w-full text-left"
                        >
                          <Card className="hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.class}`}>
                                      {sc.icon}{sc.label}
                                    </span>
                                    {event.category && (
                                      <Badge variant="outline" className="text-xs">{event.category}</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <CalendarDays className="w-3 h-3" />{event.date}
                                    </span>
                                  </div>
                                  <p className="font-semibold text-sm leading-snug line-clamp-1 mb-1">{event.title}</p>
                                  {/* Progress steps */}
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stepDone.approve ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>① 승인</span>
                                    <span className="text-gray-300 text-xs">›</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stepDone.draft ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>② SNS초안</span>
                                    <span className="text-gray-300 text-xs">›</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stepDone.card ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"}`}>③ 카드이미지</span>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── 설정 섹션 ── */}
          {activeNav === "settings" && (
            <div className="max-w-lg">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    비밀번호 변경
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (pwForm.next !== pwForm.confirm) {
                        toast({ title: "새 비밀번호가 일치하지 않습니다", variant: "destructive" });
                        return;
                      }
                      if (pwForm.next.length < 4) {
                        toast({ title: "비밀번호는 4자 이상이어야 합니다", variant: "destructive" });
                        return;
                      }
                      changePwMutation.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="pw-current">현재 비밀번호</Label>
                      <Input
                        id="pw-current"
                        type="password"
                        value={pwForm.current}
                        onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                        placeholder="현재 비밀번호"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pw-next">새 비밀번호</Label>
                      <Input
                        id="pw-next"
                        type="password"
                        value={pwForm.next}
                        onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                        placeholder="새 비밀번호 (4자 이상)"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pw-confirm">새 비밀번호 확인</Label>
                      <Input
                        id="pw-confirm"
                        type="password"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                        placeholder="새 비밀번호 재입력"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={changePwMutation.isPending || !pwForm.current || !pwForm.next || !pwForm.confirm}
                    >
                      {changePwMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── 대시보드/기타 섹션 ── */}
          {activeNav !== "ads" && activeNav !== "schedule" && activeNav !== "settings" && <>
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

    {/* 행사 상세 모달 */}
    {selectedScheduleEvent && (() => {
      const ev = selectedScheduleEvent;
      const sc = STATUS_CONFIG[ev.status];
      const stepDone = {
        approve: ev.status === "approved" || ev.status === "rejected" || ev.status === "published",
        draft: !!ev.socialDraft,
        card: !!ev.cardImageUrl,
        publish: ev.status === "published",
      };
      return (
        <Dialog open={!!selectedScheduleEvent} onOpenChange={(o) => { if (!o) setSelectedScheduleEvent(null); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base pr-6">
                <CalendarRange className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="line-clamp-2">{ev.title}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-1">
              {/* 메타 정보 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-semibold ${sc.class}`}>
                  {sc.icon}{sc.label}
                </span>
                {ev.category && <Badge variant="outline" className="text-xs">{ev.category}</Badge>}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />{ev.date}
                </span>
                <span className="text-xs text-muted-foreground">· {ev.source}</span>
              </div>

              {/* 설명 */}
              <p className="text-sm text-muted-foreground leading-relaxed bg-gray-50 rounded-lg p-3">{ev.description}</p>

              {/* 워크플로우 단계 표시 */}
              <div className="border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">SNS 발행 워크플로우</p>
                <div className="flex items-center gap-1">
                  {[
                    { label: "① 승인", done: stepDone.approve, rejected: ev.status === "rejected" },
                    { label: "② SNS 초안", done: stepDone.draft, rejected: false },
                    { label: "③ 카드이미지", done: stepDone.card, rejected: false },
                    { label: "④ 발행완료", done: stepDone.publish, rejected: false },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-1 flex-1">
                      <div className={`flex-1 text-center px-1.5 py-1.5 rounded-lg text-xs font-semibold
                        ${step.rejected ? "bg-red-100 text-red-600" : step.done ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                        {step.label}
                      </div>
                      {i < 3 && <span className="text-gray-300 text-sm">›</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* SNS 초안 미리보기 */}
              {ev.socialDraft && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />SNS 초안
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-100"
                      onClick={() => {
                        const text = `${ev.socialDraft!.caption}\n\n${ev.socialDraft!.hashtags.map((h) => `#${h}`).join(" ")}`;
                        navigator.clipboard.writeText(text).then(() => {
                          toast({ title: "복사 완료", description: "SNS 문구가 클립보드에 복사되었습니다." });
                        });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />문구 복사
                    </Button>
                  </div>
                  <p className="text-sm text-blue-800 leading-relaxed mb-2">{ev.socialDraft.caption}</p>
                  <div className="flex gap-1 flex-wrap">
                    {ev.socialDraft.hashtags.map((h) => (
                      <span key={h} className="text-xs text-blue-500 font-medium">#{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 카드 이미지 미리보기 */}
              {ev.cardImageUrl && (
                <div className="border border-purple-200 bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-purple-700 flex items-center gap-1">
                      <Image className="w-3.5 h-3.5" />카드이미지 생성 완료
                    </span>
                    <div className="flex gap-1.5">
                      <a href={ev.cardImageUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-purple-700 border-purple-300">
                          <ExternalLink className="w-3 h-3 mr-1" />보기
                        </Button>
                      </a>
                      <a href={ev.cardImageUrl} download={`${ev.title}.png`}>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-purple-700 border-purple-300 hover:bg-purple-100">
                          <Download className="w-3 h-3 mr-1" />다운로드
                        </Button>
                      </a>
                    </div>
                  </div>
                  <img
                    src={ev.cardImageUrl}
                    alt="카드이미지"
                    className="w-full rounded-lg border border-purple-200"
                  />
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex flex-col gap-2 pt-1">
                {ev.status === "draft" && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        statusMutation.mutate({ id: ev.id, status: "approved" });
                        setSelectedScheduleEvent({ ...ev, status: "approved" });
                      }}
                      disabled={statusMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4" />승인
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        statusMutation.mutate({ id: ev.id, status: "rejected" });
                        setSelectedScheduleEvent(null);
                      }}
                      disabled={statusMutation.isPending}
                    >
                      <XCircle className="w-4 h-4" />반려
                    </Button>
                  </div>
                )}

                {ev.status === "approved" && !ev.socialDraft && (
                  <Button
                    className="w-full gap-1.5"
                    onClick={() => {
                      draftMutation.mutate(ev.id, {
                        onSuccess: (d) => setSelectedScheduleEvent({ ...ev, socialDraft: d.socialDraft }),
                      });
                    }}
                    disabled={draftMutation.isPending}
                  >
                    <MessageSquare className="w-4 h-4" />
                    {draftMutation.isPending ? "SNS 초안 생성 중..." : "SNS 초안 생성"}
                  </Button>
                )}

                {ev.status === "approved" && ev.socialDraft && !ev.cardImageUrl && (
                  <Button
                    className="w-full gap-1.5 bg-purple-600 hover:bg-purple-700"
                    onClick={() => {
                      cardMutation.mutate(ev.id, {
                        onSuccess: (d) => setSelectedScheduleEvent({ ...ev, cardImageUrl: d.cardImageUrl }),
                      });
                    }}
                    disabled={cardMutation.isPending}
                  >
                    <Image className="w-4 h-4" />
                    {cardMutation.isPending ? "카드이미지 생성 중..." : "카드이미지 생성"}
                  </Button>
                )}

                {ev.status === "approved" && ev.socialDraft && ev.cardImageUrl && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <a
                        href="https://www.facebook.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          className="w-full gap-1.5 text-[#1877F2] border-[#1877F2]/30 hover:bg-[#1877F2]/10"
                        >
                          <ExternalLink className="w-4 h-4" />페이스북 열기
                        </Button>
                      </a>
                      <a
                        href="https://www.instagram.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          className="w-full gap-1.5 text-[#E1306C] border-[#E1306C]/30 hover:bg-[#E1306C]/10"
                        >
                          <ExternalLink className="w-4 h-4" />인스타 열기
                        </Button>
                      </a>
                    </div>
                    <Button
                      className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        statusMutation.mutate({ id: ev.id, status: "published" }, {
                          onSuccess: () => {
                            setSelectedScheduleEvent({ ...ev, status: "published" });
                            toast({ title: "발행완료", description: "SNS 발행완료로 처리되었습니다." });
                          },
                        });
                      }}
                      disabled={statusMutation.isPending}
                    >
                      <Send className="w-4 h-4" />발행완료 처리
                    </Button>
                  </div>
                )}

                {ev.status === "published" && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-700 font-semibold bg-blue-50 rounded-xl">
                    <Send className="w-4 h-4" /> SNS 발행완료
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedScheduleEvent(null)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    })()}

    {/* 광고 수정 다이얼로그 */}
    {editingAd && (
      <Dialog open={!!editingAd} onOpenChange={(o) => { if (!o) setEditingAd(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> 광고 수정
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              adEditMutation.mutate({
                id: editingAd.id,
                patch: {
                  title: fd.get("title") as string,
                  businessName: fd.get("businessName") as string,
                  contactName: fd.get("contactName") as string,
                  phone: fd.get("phone") as string,
                  email: fd.get("email") as string,
                  category: fd.get("category") as string,
                  description: fd.get("description") as string,
                  date: fd.get("date") as string,
                  location: fd.get("location") as string,
                  url: fd.get("url") as string,
                  plan: fd.get("plan") as Ad["plan"],
                },
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="title">광고 제목</Label>
                <Input id="title" name="title" defaultValue={editingAd.title} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="businessName">업체명</Label>
                <Input id="businessName" name="businessName" defaultValue={editingAd.businessName} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="category">카테고리</Label>
                <Input id="category" name="category" defaultValue={editingAd.category} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactName">담당자명</Label>
                <Input id="contactName" name="contactName" defaultValue={editingAd.contactName} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">연락처</Label>
                <Input id="phone" name="phone" defaultValue={editingAd.phone} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" name="email" type="email" defaultValue={editingAd.email} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="description">광고 내용</Label>
                <Textarea id="description" name="description" rows={3} defaultValue={editingAd.description} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date">행사/노출 날짜</Label>
                <Input id="date" name="date" type="date" defaultValue={editingAd.date} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location">위치</Label>
                <Input id="location" name="location" defaultValue={editingAd.location} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="url">링크 URL</Label>
                <Input id="url" name="url" defaultValue={editingAd.url} placeholder="https://" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="plan">광고 플랜</Label>
                <select
                  id="plan" name="plan"
                  defaultValue={editingAd.plan}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="basic">기본 (1일 노출)</option>
                  <option value="main">메인 (3일 노출, 상단 고정)</option>
                  <option value="premium">프리미엄 (5일 노출, 최상단)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingAd(null)}>취소</Button>
              <Button type="submit" disabled={adEditMutation.isPending}>
                {adEditMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
