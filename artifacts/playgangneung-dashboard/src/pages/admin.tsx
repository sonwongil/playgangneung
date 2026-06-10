import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  Settings,
  RefreshCw,
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
  LogOut,
  KeyRound,
  Copy,
  Send,
  Rss,
  AlertTriangle,
  ArrowUpDown,
  Smartphone,
  X,
  PlusCircle,
  Check,
  BookOpen,
  Video,
  Download,
  ImageIcon,
  BarChart2,
  BriefcaseBusiness,
  Layers,
  CalendarClock,
  Bell,
  TrendingUp,
  CircleDollarSign,
  Sparkles,
  Search,
  GripVertical,
  RotateCcw,
  Activity,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Inbox,
  Trophy,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyAdminImg(url: string): string {
  if (!url) return url;
  if (url.startsWith("/") || url.startsWith(BASE) || url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `${BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
}

interface SocialDraft {
  title: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

interface ContentBlock {
  type: "text" | "image" | "video";
  content: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  startDate?: string;
  endDate?: string;
  scheduleStatus?: string;
  link: string;
  source: string;
  sourceType: string;
  location?: string;
  category?: string;
  thumbnail?: string | null;
  videoUrl?: string | null;
  status: "draft" | "approved" | "rejected" | "published" | "submitted";
  socialDraft: SocialDraft | null;
  crawledAt: string;
  contact?: string;
  contentBlocks?: ContentBlock[] | null;
}

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
  extraImages?: string[];
  socialDraft: SocialDraft | null;
  plan: "basic" | "main" | "premium";
  status: "pending" | "approved" | "scheduled" | "published" | "rejected";
  createdAt: string;
  aiScore: number | null;
  aiNote: string | null;
  reportToken?: string | null;
  reportSentAt?: string | null;
  isPremiumFeatured?: boolean;
  metaAdId?: string | null;
  metaStatus?: string | null;
}

interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

interface AdPool {
  id: string;
  name: string;
  objective: "awareness" | "messages" | "post_engagement" | "instagram_engagement" | "page_likes" | "traffic" | "conversion" | "engagement";
  adIds: string[];
  adDates: Record<string, { startDate: string; endDate: string }>;
  totalBudget: number;
  startDate: string;
  endDate: string;
  aiMode: "equal" | "performance" | "overexposure_prevention" | "new_ad_boost" | "manual";
  rotationMode: "equal" | "performance";
  status: "draft" | "active" | "paused" | "ended";
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  metaSyncedAt?: string | null;
  metaSyncStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PoolPerformanceSummary {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalReach: number;
  ctr: number;
  cpc: number;
  budgetUsedPct: number;
}

interface AdBreakdownItem {
  adId: string;
  title: string;
  businessName: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

interface PoolPerformance {
  pool: { id: string; name: string; totalBudget: number; metaCampaignId?: string | null };
  summary: PoolPerformanceSummary;
  dailyChart: { date: string; impressions: number; clicks: number; spend: number; ctr: number }[];
  adBreakdown: AdBreakdownItem[];
  since: string;
  until: string;
}

interface PerfRow {
  id: string;
  adId: string;
  adTitle: string;
  businessName: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  source: string;
  createdAt: string;
}

interface PerfRowsData {
  rows: PerfRow[];
  total: number;
}

interface BillingSummaryItem {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  totalSpend: number;
  spendPct: number;
  elapsedPct: number;
  isExpired: boolean;
  adCount: number;
  metaSynced: boolean;
}

interface BillingSummary {
  summaries: BillingSummaryItem[];
  today: string;
}

interface MetaRateLimit {
  configured: boolean;
  rateLimit: {
    callCount: number;
    totalCputime: number;
    totalTime: number;
    type: string;
    estimatedTimeToRegain: number;
  } | null;
  warning: string | null;
}

interface MetaCampaignSpend {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  todaySpend: number;
  impressions: number;
  clicks: number;
  reach: number;
  internalDailyLimit: number | null;
  usagePct: number | null;
}

interface MetaSpendData {
  configured: boolean;
  account: {
    todaySpend: number;
    amountSpent: number | null;
    spendCap: number | null;
    currency: string;
  } | null;
  campaigns: MetaCampaignSpend[];
  fetchedAt: string;
}

interface MetaAdSetSpend {
  id: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  todaySpend: number;
  impressions: number;
  clicks: number;
}

interface MetaAdSpend {
  id: string;
  name: string;
  status: string;
  todaySpend: number;
  impressions: number;
  clicks: number;
}

interface MetaCampaignDetail {
  adsets: MetaAdSetSpend[];
  ads: MetaAdSpend[];
}

interface AdProduct {
  id: string;
  name: string;
  description: string;
  amount: number;
  adDurationDays: number | null;
  productType: string;
  isActive: boolean;
  sortOrder: number;
  marginRate: number;
  createdAt: string;
  updatedAt: string;
}

interface AdPayment {
  id: string;
  orderId: string;
  paymentKey: string | null;
  adId: string | null;
  productId: string | null;
  productNameSnapshot: string | null;
  productPriceSnapshot: number | null;
  marginRateSnapshot: number | null;
  adDurationDaysSnapshot: number | null;
  productTypeSnapshot: string | null;
  plan: string;
  amount: number;
  status: string;
  method: string | null;
  receiptUrl: string | null;
  customerName: string;
  customerEmail: string;
  depositName: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AdCenterStats {
  total: number;
  active: number;
  pending: number;
  needsReview: number;
  todayBudget: number;
  activePools: number;
  draftPools: number;
}

interface AdCenterAlert {
  type: string;
  level: "info" | "warning" | "error";
  message: string;
  adId?: string;
}

interface RotationSlot {
  hour: number;
  adId: string | null;
  adName: string | null;
  weight: number;
  status: string;
  aiReason: string | null;
}

interface BlogSource {
  id: string;
  name: string;
  blogId: string;
  enabled: boolean;
  createdAt: string;
}

interface AdminStory {
  id: string;
  title: string;
  body: string;
  images: string[];
  thumbnailUrl: string | null;
  sourceUrl: string;
  author: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminVideo {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string | null;
  description: string;
  embeddable: boolean | null;
  viewCount: number | null;
  status: string;
  socialCaption: string | null;
  createdAt: string;
  updatedAt: string;
}

type NavKey = "dashboard" | "adCenter" | "stories" | "videos" | "sources" | "settings" | "members" | "top5";

const NAV_ITEMS: { icon: React.ReactNode; label: string; key: NavKey }[] = [
  { icon: <LayoutDashboard className="w-4 h-4" />, label: "대시보드", key: "dashboard" },
  { icon: <Trophy className="w-4 h-4" />, label: "TOP 5", key: "top5" },
  { icon: <BriefcaseBusiness className="w-4 h-4" />, label: "광고센터", key: "adCenter" },
  { icon: <BookOpen className="w-4 h-4" />, label: "스토리", key: "stories" },
  { icon: <Video className="w-4 h-4" />, label: "영상", key: "videos" },
  { icon: <Rss className="w-4 h-4" />, label: "크롤링 소스", key: "sources" },
  { icon: <Settings className="w-4 h-4" />, label: "설정", key: "settings" },
  { icon: <Activity className="w-4 h-4" />, label: "회원 관리", key: "members" },
];

function extractYoutubeThumb(videoUrl?: string | null): string | null {
  if (!videoUrl) return null;
  try {
    const u = new URL(videoUrl);
    let id: string | null = null;
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1).split("?")[0];
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else { const m = u.pathname.match(/\/shorts\/([^/?]+)/); if (m) id = m[1]; }
    if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  } catch { /* not a URL */ }
  return null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  submitted: { label: "제보대기", icon: <Inbox className="w-3 h-3" />,       cls: "bg-purple-100 text-purple-700 border-purple-200" },
  pending:   { label: "수집됨",   icon: <Clock className="w-3 h-3" />,       cls: "bg-gray-100 text-gray-600 border-gray-200" },
  draft:     { label: "검토 중",   icon: <Clock className="w-3 h-3" />,       cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     icon: <CheckCircle className="w-3 h-3" />,  cls: "bg-green-100 text-green-700 border-green-200" },
  rejected:  { label: "반려",     icon: <XCircle className="w-3 h-3" />,      cls: "bg-red-100 text-red-700 border-red-200" },
  published: { label: "발행완료", icon: <Send className="w-3 h-3" />,         cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

const AD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "접수대기", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     cls: "bg-green-100 text-green-700 border-green-200" },
  scheduled: { label: "발행예정", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  published: { label: "발행완료", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  rejected:  { label: "제외",     cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function Admin() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [eventsImgRefetching, setEventsImgRefetching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [mobilePreviewPath, setMobilePreviewPath] = useState("/");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editBlocks, setEditBlocks] = useState<ContentBlock[]>([]);
  const [addBlockType, setAddBlockType] = useState<ContentBlock["type"]>("text");
  const [addBlockContent, setAddBlockContent] = useState("");
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualThumbnail, setManualThumbnail] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  // KST(UTC+9) 기준 날짜 문자열 반환 — new Date().toISOString()은 UTC 날짜를 반환하므로 사용 금지
  const kstNow = (offsetDays = 0) =>
    new Date(Date.now() + (9 + offsetDays * 24) * 3600 * 1000).toISOString().slice(0, 10);
  const todayStr = () => kstNow(0);
  const [manualForm, setManualForm] = useState({
    title: "", description: "", link: "", source: "", contact: "",
    category: "행사", startDate: todayStr(), endDate: todayStr(), location: "", videoUrl: "",
  });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [bannerForm, setBannerForm] = useState({
    subtitle: "",
    stat1Label: "광고 신청", stat1Value: "누적 120건+",
    stat2Label: "PLAY강릉 팔로워", stat2Value: "55만명+",
    stat3Label: "월 방문자", stat3Value: "10만명+",
    ctaText: "지금 바로 시작하세요!",
    banner1Sub: "지역 소상공인을 위한",
    banner1Title: "공동광고 지원센터",
    banner1Cta: "지금 바로\n시작하기 →",
    banner2Badge: "📢 공동광고 모집중",
    banner2Cta: "참여하기 →",
  });
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [scheduleHour, setScheduleHour] = useState(9);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [showStoryDialog, setShowStoryDialog] = useState(false);
  const [storyForm, setStoryForm] = useState({ title: "", body: "", imagesStr: "", sourceUrl: "", author: "", tagsStr: "" });
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [videoForm, setVideoForm] = useState({ youtubeUrl: "", title: "", channelName: "", description: "" });
  const [videoIsFetching, setVideoIsFetching] = useState(false);
  const [videoSnsCaption, setVideoSnsCaption] = useState("");
  const [previewStory, setPreviewStory] = useState<AdminStory | null>(null);
  const [previewVideo, setPreviewVideo] = useState<AdminVideo | null>(null);
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [storyImgRefetching, setStoryImgRefetching] = useState(false);
  const [editingStoryThumb, setEditingStoryThumb] = useState<{ id: string; thumbUrl: string } | null>(null);
  const [storyUrlExtracting, setStoryUrlExtracting] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isCrawlingStories, setIsCrawlingStories] = useState(false);
  const [isCrawlingVideos, setIsCrawlingVideos] = useState(false);
  const [naverQuery, setNaverQuery] = useState("강릉 맛집");
  const [naverPeriodUnit, setNaverPeriodUnit] = useState<"days" | "months" | "years">("months");
  const [naverPeriodValue, setNaverPeriodValue] = useState(3);
  const [isNaverCrawling, setIsNaverCrawling] = useState(false);
  const [ytCrawlQuery, setYtCrawlQuery] = useState("강릉");
  const [ytChannelId, setYtChannelId] = useState("");
  const [ytPeriodUnit, setYtPeriodUnit] = useState<"days" | "months" | "years">("months");
  const [ytPeriodValue, setYtPeriodValue] = useState(3);
  // inline draft editing: map of eventId → { caption, hashtagsStr }
  const [draftEdits, setDraftEdits] = useState<Record<string, { caption: string; hashtagsStr: string }>>({});
  // 광고 SNS 초안 편집
  const [adDraftEdits, setAdDraftEdits] = useState<Record<string, { caption: string; hashtagsStr: string }>>({});
  const [adCopied, setAdCopied] = useState(false);
  const [adCardUrls, setAdCardUrls] = useState<Record<string, string[]>>({});
  const [adCardLoading, setAdCardLoading] = useState<Record<string, boolean>>({});
  const [adCenterTab, setAdCenterTab] = useState<"overview" | "applications" | "createPool" | "rotation" | "meta" | "monitoring" | "performance" | "billing">("overview");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [generatingRotationId, setGeneratingRotationId] = useState<string | null>(null);
  const [alertDetectLoading, setAlertDetectLoading] = useState(false);
  const [poolForm, setPoolForm] = useState({
    name: "", objective: "awareness" as AdPool["objective"],
    selectedAdIds: [] as string[],
    adDates: {} as Record<string, { startDate: string; endDate: string }>,
    totalBudget: 0,
    startDate: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10),
    endDate: new Date(Date.now() + (30 * 24 + 9) * 3600 * 1000).toISOString().slice(0, 10),
    aiMode: "equal" as AdPool["aiMode"],
    rotationMode: "equal" as AdPool["rotationMode"],
  });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const deployedBuildTime = useRef<string | null>(null);

  async function handleNaverCrawl() {
    if (!naverQuery.trim() || isNaverCrawling) return;
    setIsNaverCrawling(true);
    try {
      const r = await fetch(`${BASE}/api/stories/naver-crawl`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query: naverQuery.trim(),
          display: 30,
          period: { unit: naverPeriodUnit, value: naverPeriodValue },
        }),
      });
      const d = await r.json() as { message?: string; error?: string };
      if (!r.ok) toast({ description: d.error ?? "수집 실패", variant: "destructive" });
      else { toast({ description: d.message ?? "수집 완료" }); refetchStories(); }
    } catch { toast({ description: "수집 실패", variant: "destructive" }); }
    finally { setIsNaverCrawling(false); }
  }

  useEffect(() => {
    async function checkVersion() {
      try {
        const r = await fetch(`${BASE}/api/version`);
        if (!r.ok) return;
        const { buildTime } = await r.json() as { buildTime: string };
        if (deployedBuildTime.current === null) {
          deployedBuildTime.current = buildTime;
        } else if (deployedBuildTime.current !== buildTime) {
          deployedBuildTime.current = buildTime;
          toast({
            title: "✅ 새 버전 배포 완료",
            description: "페이지를 새로고침하면 최신 버전이 적용됩니다.",
            duration: 0,
            action: (
              <button
                onClick={() => window.location.reload()}
                className="shrink-0 rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                새로고침
              </button>
            ),
          } as any);
        }
      } catch {
        // 네트워크 오류 무시
      }
    }
    checkVersion();
    const id = setInterval(checkVersion, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("이벤트 로드 실패");
      return r.json();
    },
  });

  const { data: adsData, isLoading: adsLoading, refetch: refetchAds } = useQuery<{ ads: Ad[] }>({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ads`, { credentials: "include" });
      if (!r.ok) throw new Error("광고 로드 실패");
      return r.json();
    },
    enabled: activeNav === "adCenter",
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ sources: Source[] }>({
    queryKey: ["sources"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sources`, { credentials: "include" });
      if (!r.ok) throw new Error("소스 로드 실패");
      return r.json();
    },
    enabled: activeNav === "sources",
  });

  const { data: scheduleData } = useQuery<{ crawlHour: number; crawlMinute: number }>({
    queryKey: ["schedule"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/schedule`, { credentials: "include" });
      return r.json();
    },
    enabled: activeNav === "settings",
    onSuccess: (d: { crawlHour: number; crawlMinute: number }) => { setScheduleHour(d.crawlHour); setScheduleMinute(d.crawlMinute); },
  } as any);

  useQuery<{
    subtitle: string; stat1Label: string; stat1Value: string;
    stat2Label: string; stat2Value: string; stat3Label: string; stat3Value: string; ctaText: string;
    banner1Sub: string; banner1Title: string; banner1Cta: string; banner2Badge: string; banner2Cta: string;
  }>({
    queryKey: ["banner-config"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/banner-config`, { credentials: "include" });
      if (!r.ok) throw new Error("배너 로드 실패");
      return r.json();
    },
    enabled: activeNav === "settings" && !bannerLoaded,
    onSuccess: (d: { subtitle: string; stat1Label: string; stat1Value: string; stat2Label: string; stat2Value: string; stat3Label: string; stat3Value: string; ctaText: string; banner1Sub: string; banner1Title: string; banner1Cta: string; banner2Badge: string; banner2Cta: string; }) => { setBannerForm({ ...d }); setBannerLoaded(true); },
  } as any);

  const { data: adCenterStatsData } = useQuery<{ stats: AdCenterStats }>({
    queryKey: ["ad-center-stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-center/stats`, { credentials: "include" });
      if (!r.ok) throw new Error("통계 로드 실패");
      return r.json();
    },
    enabled: activeNav === "adCenter",
    refetchInterval: activeNav === "adCenter" ? 30000 : false,
  } as any);

  const { data: adCenterAlertsData } = useQuery<{ alerts: AdCenterAlert[] }>({
    queryKey: ["ad-center-alerts"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-center/alerts`, { credentials: "include" });
      if (!r.ok) throw new Error("알림 로드 실패");
      return r.json();
    },
    enabled: activeNav === "adCenter",
  } as any);

  const { data: adPoolsData, isLoading: poolsLoading, refetch: refetchPools } = useQuery<{ pools: AdPool[]; total: number }>({
    queryKey: ["ad-pools"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-pools`, { credentials: "include" });
      if (!r.ok) throw new Error("묶음 로드 실패");
      return r.json();
    },
    enabled: activeNav === "adCenter",
  });

  const { data: rotationData } = useQuery<{ slots: RotationSlot[]; pool: AdPool }>({
    queryKey: ["ad-pool-rotation", selectedPoolId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-pools/${selectedPoolId}/rotation`, { credentials: "include" });
      if (!r.ok) throw new Error("편성표 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && selectedPoolId),
  });

  const [perfPoolId, setPerfPoolId] = useState<string | null>(null);
  const [perfSince, setPerfSince] = useState(() => new Date(Date.now() + 9 * 3600 * 1000 - 30 * 86400000).toISOString().slice(0, 10));
  const [perfUntil, setPerfUntil] = useState(() => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10));
  const [seedLoading, setSeedLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualAdId, setManualAdId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10));
  const [manualImpressions, setManualImpressions] = useState("");
  const [manualClicks, setManualClicks] = useState("");
  const [manualSpend, setManualSpend] = useState("");
  const [manualReach, setManualReach] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [metaPushLoading, setMetaPushLoading] = useState<string | null>(null);
  const [metaStatusRefreshLoading, setMetaStatusRefreshLoading] = useState<string | null>(null);
  const [metaToggleLoading, setMetaToggleLoading] = useState<string | null>(null);
  const [billingExpireLoading, setBillingExpireLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState<string | null>(null);
  const [bankConfirmLoading, setBankConfirmLoading] = useState<string | null>(null);
  const [bankRejectLoading, setBankRejectLoading] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<Record<string, MetaCampaignDetail>>({});
  const [campaignDetailLoading, setCampaignDetailLoading] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = useState("");
  const [budgetSaveLoading, setBudgetSaveLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdProduct | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", amount: "", adDurationDays: "", productType: "ad_run", isActive: true, sortOrder: "0", marginRate: "30" });
  const [productFormLoading, setProductFormLoading] = useState(false);

  const { data: poolPerfData, isLoading: poolPerfLoading, refetch: refetchPoolPerf } = useQuery<PoolPerformance>({
    queryKey: ["pool-performance", perfPoolId, perfSince, perfUntil],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-pools/${perfPoolId}/performance?since=${perfSince}&until=${perfUntil}`, { credentials: "include" });
      if (!r.ok) throw new Error("성과 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "performance" && perfPoolId),
  });

  const { data: perfRowsData, refetch: refetchPerfRows } = useQuery<PerfRowsData>({
    queryKey: ["pool-performance-rows", perfPoolId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-pools/${perfPoolId}/performance/rows`, { credentials: "include" });
      if (!r.ok) throw new Error("입력 내역 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "performance" && perfPoolId),
  });

  const { data: billingSummaryData, isLoading: billingLoading, refetch: refetchBilling } = useQuery<BillingSummary>({
    queryKey: ["billing-summary"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/billing/summary`, { credentials: "include" });
      if (!r.ok) throw new Error("정산 현황 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "billing"),
  });

  const { data: paymentOrdersData, isLoading: paymentOrdersLoading, refetch: refetchPaymentOrders } = useQuery<{ orders: AdPayment[] }>({
    queryKey: ["payment-orders"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/payment/orders`, { credentials: "include" });
      if (!r.ok) throw new Error("결제 내역 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "billing"),
  });

  const { data: adminProductsData, isLoading: adminProductsLoading, refetch: refetchAdminProducts } = useQuery<{ products: AdProduct[] }>({
    queryKey: ["admin-ad-products"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/ad-products`, { credentials: "include" });
      if (!r.ok) throw new Error("광고 상품 로드 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "billing"),
  });

  const { data: metaRateLimitData, refetch: refetchRateLimit } = useQuery<MetaRateLimit>({
    queryKey: ["meta-rate-limit"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/meta/rate-limit`, { credentials: "include" });
      if (!r.ok) throw new Error("rate-limit 조회 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "meta"),
    refetchInterval: 60000,
  });

  const [top5Search, setTop5Search] = useState("");
  const [top5Draft, setTop5Draft] = useState<{ eventId: string; rank: number; title: string; thumbnail: string | null }[]>([]);
  const [top5Saving, setTop5Saving] = useState(false);
  const [top5ThumbEdit, setTop5ThumbEdit] = useState<{ eventId: string; title: string } | null>(null);
  const [top5ThumbInput, setTop5ThumbInput] = useState("");
  const [top5ThumbSaving, setTop5ThumbSaving] = useState(false);
  const [top5CarouselOpen, setTop5CarouselOpen] = useState(false);
  const [top5CarouselSending, setTop5CarouselSending] = useState(false);
  const [metaTokenInput, setMetaTokenInput] = useState("");
  const [metaTokenOpen, setMetaTokenOpen] = useState(false);
  const [top5DraftDate, setTop5DraftDate] = useState<string>(() => {
    const kst = new Date(Date.now() + 9 * 3600_000);
    return kst.toISOString().slice(0, 10);
  });

  const { data: top5TodayData, refetch: refetchTop5Today } = useQuery<{ date: string; items: { rank: number; id: string; eventId: string; title: string; thumbnail: string | null; category: string; date: string }[] }>({
    queryKey: ["admin-top5-today", top5DraftDate],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/top5?date=${top5DraftDate}`, { credentials: "include" });
      if (!r.ok) throw new Error("TOP 5 조회 실패");
      return r.json();
    },
    enabled: activeNav === "top5",
  });

  const { data: top5EventsData } = useQuery<{ events: { id: string; title: string; thumbnail: string | null; status: string; category: string; startDate: string; scheduleStatus: string }[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("이벤트 조회 실패");
      return r.json();
    },
    enabled: activeNav === "top5",
  });

  const [monitoringExpandedAd, setMonitoringExpandedAd] = useState<string | null>(null);
  const [monitoringCollectLoading, setMonitoringCollectLoading] = useState(false);
  const [monitoringDatePreset, setMonitoringDatePreset] = useState<"today" | "yesterday" | "last_7d" | "last_30d">("today");
  const [monitoringPoolFilter, setMonitoringPoolFilter] = useState<string>("all");
  const [monitoringHealthFilter, setMonitoringHealthFilter] = useState<"all" | "critical" | "warning" | "ok">("all");
  const [monitoringShowTips, setMonitoringShowTips] = useState<string | null>(null);

  interface MonitoringInsight {
    id: string; adId: string; adName: string;
    adSetId: string | null; adSetName: string | null;
    campaignId: string | null; campaignName: string | null;
    dateStart: string; dateStop: string;
    impressions: number; clicks: number; spend: number; reach: number;
    frequency: number | null; ctr: number | null; cpc: number | null; cpp: number | null;
    status: string | null; healthStatus: string; healthIssues: string[];
    collectedAt: string;
    businessName: string | null;
    adTitle: string | null;
    internalAdId: string | null;
    pools: { poolId: string; poolName: string; poolStatus: string }[];
    issues: string[];
    tips: string[];
  }

  const { data: metaInsightsData, isLoading: metaInsightsLoading, refetch: refetchInsights } = useQuery<{
    configured: boolean;
    insights: MonitoringInsight[];
    summary: {
      total: number; ok: number; warning: number; critical: number;
      totalSpend: number; totalImpressions: number; totalClicks: number;
      lastCollectedAt: string | null;
    };
  }>({
    queryKey: ["meta-insights", monitoringDatePreset],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/meta/insights`, { credentials: "include" });
      if (!r.ok) throw new Error("Insights 조회 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "monitoring"),
    refetchInterval: !!(activeNav === "adCenter" && adCenterTab === "monitoring") ? 120000 : false,
  });

  const { data: metaSpendData, isLoading: metaSpendLoading, refetch: refetchMetaSpend } = useQuery<MetaSpendData>({
    queryKey: ["meta-spend"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/meta/spend`, { credentials: "include" });
      if (!r.ok) throw new Error("Meta 지출 조회 실패");
      return r.json();
    },
    enabled: !!(activeNav === "adCenter" && adCenterTab === "billing"),
    refetchInterval: !!(activeNav === "adCenter" && adCenterTab === "billing") ? 120000 : false,
  });

  const { data: storiesData, isLoading: storiesLoading, refetch: refetchStories } = useQuery<{ stories: AdminStory[] }>({
    queryKey: ["admin-stories"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/stories/all`, { credentials: "include" });
      if (!r.ok) throw new Error("스토리 로드 실패");
      return r.json();
    },
    enabled: activeNav === "stories",
  });


  const { data: videosData, isLoading: videosLoading, refetch: refetchVideos } = useQuery<{ videos: AdminVideo[] }>({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/videos/all`, { credentials: "include" });
      if (!r.ok) throw new Error("영상 로드 실패");
      return r.json();
    },
    enabled: activeNav === "videos",
  });

  interface MemberTip { userId: string | null; authorDisplayName: string | null; id: string; title: string; status: string; crawledAt: string; }
  interface MemberAd { userId: string | null; id: string; title: string; businessName: string; status: string; createdAt: string; }
  interface Member { userId: string; displayName: string | null; tipCount: number; adCount: number; lastActivity: string; tips: MemberTip[]; ads: MemberAd[]; }

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: Member[]; total: number }>({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/members`, { credentials: "include" });
      if (!r.ok) throw new Error("회원 목록 조회 실패");
      return r.json();
    },
    enabled: activeNav === "members",
  });
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const [adminSortBy, setAdminSortBy] = useState<"date" | "latest">("latest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsStatusFilter, setEventsStatusFilter] = useState("all");
  const [adsSearch, setAdsSearch] = useState("");
  const [adsStatusFilter, setAdsStatusFilter] = useState("all");

  const SCHEDULE_ORDER: Record<string, number> = {
    today: 0, ongoing: 1, tomorrow: 2, upcoming: 3, dateUnknown: 4, ended: 5,
  };
  function sortBySchedule(arr: Event[], sortBy: "date" | "latest" = "date") {
    if (sortBy === "latest") {
      return [...arr]; // DB already orders by updated_at DESC
    }
    return [...arr].sort((a, b) => {
      const sa = SCHEDULE_ORDER[a.scheduleStatus ?? ""] ?? 4;
      const sb = SCHEDULE_ORDER[b.scheduleStatus ?? ""] ?? 4;
      if (sa !== sb) return sa - sb;
      const da = a.startDate ?? a.date ?? "";
      const db = b.startDate ?? b.date ?? "";
      if (a.scheduleStatus === "ended") return db.localeCompare(da);
      return da.localeCompare(db);
    });
  }

  const allEvents: Event[] = sortBySchedule(data?.events ?? [], adminSortBy);
  const events: Event[] = allEvents.filter((ev) => {
    const q = eventsSearch.toLowerCase().trim();
    if (q && !ev.title?.toLowerCase().includes(q) && !ev.source?.toLowerCase().includes(q) && !ev.description?.toLowerCase().includes(q)) return false;
    if (eventsStatusFilter !== "all" && ev.status !== eventsStatusFilter) return false;
    return true;
  });

  const allAds: Ad[] = adsData?.ads ?? [];
  const ads: Ad[] = allAds.filter((ad) => {
    const q = adsSearch.toLowerCase().trim();
    if (q && !ad.title?.toLowerCase().includes(q) && !ad.businessName?.toLowerCase().includes(q) && !ad.phone?.toLowerCase().includes(q)) return false;
    if (adsStatusFilter !== "all" && ad.status !== adsStatusFilter) return false;
    return true;
  });

  // derived lists
  const feedEvents = events.filter((e) => e.status === "approved");
  const publishEvents = events.filter(
    (e) => e.status === "approved" && e.socialDraft,
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const crawlMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/crawl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) throw new Error("크롤링 실패");
      return r.json();
    },
    onSuccess: (d) => { toast({ title: "크롤링 완료", description: `${d.added ?? 0}건 추가` }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "크롤링 실패", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`${BASE}/api/events/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("상태 변경 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "상태 변경 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const draftMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/events/${id}/draft`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "초안 생성 실패"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "SNS 초안 생성 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "초안 생성 실패", description: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ id, caption, hashtags }: { id: string; caption: string; hashtags: string[] }) => {
      const r = await fetch(`${BASE}/api/events/${id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "저장 실패"); }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "초안 저장 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setDraftEdits((prev) => { const n = { ...prev }; delete n[d.id]; return n; });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/events/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "삭제 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetch(`${BASE}/api/events/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error("일괄 삭제 실패");
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: `${d.removed}개 삭제 완료` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await fetch(`${BASE}/api/events/bulk/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) throw new Error("일괄 승인 실패");
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: `${d.approved}개 승인 완료` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: () => toast({ title: "승인 실패", variant: "destructive" }),
  });

  useEffect(() => {
    if (editingEvent) {
      setEditThumbnailUrl(editingEvent.thumbnail ?? "");
      setEditBlocks(editingEvent.contentBlocks ?? []);
      setAddBlockContent("");
      setAddBlockType("text");
    }
  }, [editingEvent]);

  const editEventMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Event> & { contentBlocks?: ContentBlock[] | null } }) => {
      const r = await fetch(`${BASE}/api/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("수정 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "수정 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); setEditingEvent(null); },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { const r = await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" }); if (!r.ok) throw new Error(); return r.json(); },
    onSuccess: () => { qc.clear(); navigate("/login"); },
    onError: () => toast({ title: "로그아웃 실패", variant: "destructive" }),
  });

  const changePwMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const r = await fetch(`${BASE}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ currentPassword, newPassword }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "비밀번호 변경 실패");
      return d;
    },
    onSuccess: () => { toast({ title: "비밀번호 변경 완료" }); setPwForm({ current: "", next: "", confirm: "" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function resetManualDialog() {
    setShowManualDialog(false);
    setManualThumbnail("");
    setUrlInput("");
    setIsExtracting(false);
    setManualForm({ title: "", description: "", link: "", source: "", contact: "", category: "행사", startDate: todayStr(), endDate: todayStr(), location: "", videoUrl: "" });
  }

  async function handleExtractUrl() {
    if (!urlInput.trim()) return;
    setIsExtracting(true);
    try {
      const r = await fetch(`${BASE}/api/events/extract-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "추출 실패");
      setManualForm((prev) => ({
        ...prev,
        title: d.title || prev.title,
        description: d.description || prev.description,
        link: d.link || prev.link,
        location: d.location || prev.location,
      }));
      if (d.thumbnail) setManualThumbnail(d.thumbnail);
      toast({ title: "자동 추출 완료", description: "내용을 확인하고 필요하면 수정하세요." });
    } catch (e: any) {
      toast({ title: "추출 실패", description: e.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }

  const manualMutation = useMutation({
    mutationFn: async (body: Record<string, string | null | undefined>) => {
      const r = await fetch(`${BASE}/api/events/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "등록 실패");
      return d;
    },
    onSuccess: (d) => {
      toast({ title: "등록 완료", description: `총 ${d.total}건` });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      resetManualDialog();
    },
    onError: (e: Error) => toast({ title: "등록 실패", description: e.message, variant: "destructive" }),
  });

  const createPoolMutation = useMutation({
    mutationFn: async (body: Omit<AdPool, "id" | "createdAt" | "updatedAt" | "status">) => {
      const r = await fetch(`${BASE}/api/ad-pools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "생성 실패");
      return d as { success: boolean; pool: AdPool };
    },
    onSuccess: (d) => {
      toast({ title: "묶음 생성 완료", description: d.pool.name });
      qc.invalidateQueries({ queryKey: ["ad-pools"] });
      qc.invalidateQueries({ queryKey: ["ad-center-stats"] });
      setAdCenterTab("rotation");
      setSelectedPoolId(d.pool.id);
      setPoolForm({
        name: "", objective: "awareness", selectedAdIds: [], adDates: {}, totalBudget: 0,
        startDate: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + (30 * 24 + 9) * 3600 * 1000).toISOString().slice(0, 10),
        aiMode: "equal",
        rotationMode: "equal",
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const poolStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdPool["status"] }) => {
      const r = await fetch(`${BASE}/api/ad-pools/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status }),
      });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "실패"); return d;
    },
    onSuccess: () => { toast({ title: "상태 변경 완료" }); qc.invalidateQueries({ queryKey: ["ad-pools"] }); qc.invalidateQueries({ queryKey: ["ad-center-stats"] }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const adStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`${BASE}/api/ads/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error(); return r.json() as Promise<{ success: boolean; ad?: Ad; autoSend?: { channels: string[]; errors: string[] } | null }>;
    },
    onSuccess: (data, vars) => {
      toast({ title: "상태 변경 완료" });
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      // 승인 전환 시 자동 발송 결과 toast
      if (vars.status === "approved" && data.autoSend) {
        if (data.autoSend.channels.length > 0) {
          const labels = data.autoSend.channels.map((c) => c === "email" ? "이메일" : "SMS").join("·");
          toast({ title: `리포트 자동 발송 완료 (${labels})`, description: "광고주에게 리포트 링크가 전달되었습니다." });
        } else if (data.autoSend.errors.length > 0) {
          toast({ title: "리포트 자동 발송 실패", description: data.autoSend.errors.join(", "), variant: "destructive" });
        }
      }
    },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const adDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/ads/${id}`, { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { toast({ title: "삭제 완료" }); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const [reportLinkLoading, setReportLinkLoading] = useState<string | null>(null);
  async function handleCopyReportLink(adId: string) {
    setReportLinkLoading(adId);
    try {
      const r = await fetch(`${BASE}/api/ads/${adId}/report-token`, { method: "POST", credentials: "include" });
      const d = await r.json() as { token?: string; error?: string };
      if (!r.ok || !d.token) throw new Error(d.error ?? "토큰 발급 실패");
      const url = `${window.location.origin}${BASE}/report/${d.token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "리포트 링크 복사됨", description: "광고주에게 붙여넣기로 전달하세요." });
    } catch (e: any) {
      toast({ title: e.message ?? "리포트 링크 생성 실패", variant: "destructive" });
    } finally {
      setReportLinkLoading(null);
    }
  }

  const [resetReportLoading, setResetReportLoading] = useState<string | null>(null);
  async function handleResetReportToken(adId: string) {
    if (!confirm("기존 리포트 링크가 즉시 무효화되고 새 링크가 발급됩니다.\n기존 링크로 접근하면 404 오류가 발생합니다.\n\n계속하시겠습니까?")) return;
    setResetReportLoading(adId);
    try {
      const r = await fetch(`${BASE}/api/ads/${adId}/report-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const d = await r.json() as { token?: string; error?: string };
      if (!r.ok || !d.token) throw new Error(d.error ?? "토큰 재발급 실패");
      const url = `${window.location.origin}${BASE}/report/${d.token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "리포트 링크 재발급 완료", description: "새 링크가 클립보드에 복사됐습니다. 기존 링크는 더 이상 사용할 수 없습니다." });
    } catch (e: any) {
      toast({ title: e.message ?? "토큰 재발급 실패", variant: "destructive" });
    } finally {
      setResetReportLoading(null);
    }
  }

  const [sendReportLoading, setSendReportLoading] = useState<string | null>(null);
  async function handleSendReport(ad: Ad) {
    setSendReportLoading(ad.id);
    try {
      const r = await fetch(`${BASE}/api/ads/${ad.id}/send-report`, { method: "POST", credentials: "include" });
      const d = await r.json() as { success?: boolean; error?: string; hint?: string; email?: string; phone?: string; sentAt?: string; reportUrl?: string; mailNotConfigured?: boolean; channels?: string[] };
      if (d.mailNotConfigured && d.reportUrl) {
        // 이메일·SMS 모두 미설정 — 링크 복사로 폴백
        await navigator.clipboard.writeText(d.reportUrl);
        toast({ title: "발송 설정 없음 — 링크 복사됨", description: d.hint ?? "SMTP_HOST 또는 SMS_API_KEY 설정 후 자동 발송이 가능합니다." });
        return;
      }
      if (!r.ok || !d.success) throw new Error(d.error ?? "발송 실패");
      // 로컬 상태 업데이트
      if (selectedAd && selectedAd.id === ad.id) {
        setSelectedAd({ ...selectedAd, reportSentAt: d.sentAt ?? null });
      }
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      const channelLabels = (d.channels ?? []).map((c) => c === "email" ? `이메일(${d.email ?? ad.email})` : `SMS(${d.phone ?? ad.phone})`).join(", ");
      toast({ title: "리포트 발송 완료", description: channelLabels || `${d.email ?? ad.email}로 발송되었습니다.` });
    } catch (e: any) {
      toast({ title: e.message ?? "리포트 발송 실패", variant: "destructive" });
    } finally {
      setSendReportLoading(null);
    }
  }

  async function handleAlertDetect() {
    setAlertDetectLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ad-center/alerts/detect`, { method: "POST", credentials: "include" });
      const d = await r.json() as { detected: number; inserted: number; skippedDuplicates: number; error?: string };
      if (!r.ok) throw new Error(d.error ?? "알림 감지 실패");
      qc.invalidateQueries({ queryKey: ["ad-center-alerts"] });
      toast({ title: `알림 감지 완료`, description: `${d.inserted}건 신규 저장, ${d.skippedDuplicates}건 중복 건너뜀` });
    } catch (e: any) {
      toast({ title: e.message ?? "알림 감지 실패", variant: "destructive" });
    } finally {
      setAlertDetectLoading(false);
    }
  }

  async function handleGenerateRotation(poolId: string) {
    setGeneratingRotationId(poolId);
    try {
      const r = await fetch(`${BASE}/api/ad-pools/${poolId}/generate-rotation`, { method: "POST", credentials: "include" });
      const d = await r.json() as { count: number; aiMode: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? "편성표 생성 실패");
      qc.invalidateQueries({ queryKey: ["ad-pool-rotation", poolId] });
      toast({ title: `AI 편성표 생성 완료`, description: `${d.count}개 슬롯 배정 (${d.aiMode} 전략)` });
    } catch (e: any) {
      toast({ title: e.message ?? "편성표 생성 실패", variant: "destructive" });
    } finally {
      setGeneratingRotationId(null);
    }
  }

  async function handleRefund(orderId: string) {
    if (!confirm("환불 처리하시겠습니까? 토스페이먼츠에서 즉시 취소됩니다.")) return;
    setRefundLoading(orderId);
    try {
      const r = await fetch(`${BASE}/api/payment/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cancelReason: "관리자 환불 처리" }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "환불 실패");
      toast({ title: "환불 완료", description: "결제가 취소되었습니다." });
      refetchPaymentOrders();
    } catch (e) {
      toast({ title: "환불 실패", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRefundLoading(null);
    }
  }

  async function handleBankConfirm(orderId: string) {
    if (!confirm("입금을 확인하시겠습니까? 광고 신청이 자동으로 생성됩니다.")) return;
    setBankConfirmLoading(orderId);
    try {
      const r = await fetch(`${BASE}/api/payment/bank-transfer/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "입금 확인 실패");
      toast({ title: "입금 확인 완료", description: "광고 신청이 생성됐습니다." });
      refetchPaymentOrders();
    } catch (e) {
      toast({ title: "처리 실패", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBankConfirmLoading(null);
    }
  }

  async function handleBankReject(orderId: string) {
    if (!confirm("입금을 거절/보류 처리하시겠습니까?")) return;
    setBankRejectLoading(orderId);
    try {
      const r = await fetch(`${BASE}/api/payment/bank-transfer/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "거절 처리 실패");
      toast({ title: "거절 처리 완료" });
      refetchPaymentOrders();
    } catch (e) {
      toast({ title: "처리 실패", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBankRejectLoading(null);
    }
  }

  const adEditMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Ad> }) => {
      const r = await fetch(`${BASE}/api/ads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { toast({ title: "수정 완료" }); qc.invalidateQueries({ queryKey: ["admin-ads"] }); setEditingAd(null); },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  const generateCardsBatchMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/generate-cards-batch`, { method: "POST", credentials: "include" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "실패"); return d as { total: number; generated: number; skipped: number };
    },
    onSuccess: (d) => {
      toast({ title: `${d.generated}건 카드이미지 생성 완료${d.skipped ? ` (${d.skipped}건 건너뜀)` : ""}` });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const regenerateDraftsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/regenerate-drafts`, { method: "POST", credentials: "include" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "실패"); return d as { total: number; regenerated: number };
    },
    onSuccess: (d) => {
      toast({ title: d.regenerated === 0 ? "모두 최신 링크" : `${d.regenerated}건 재생성 완료` });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const regenerateAdDraftsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/ads/regenerate-drafts`, { method: "POST", credentials: "include" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "실패"); return d as { total: number; regenerated: number };
    },
    onSuccess: (d) => {
      toast({ title: d.regenerated === 0 ? "광고접수 초안 모두 최신" : `광고접수 ${d.regenerated}건 원문링크 추가 완료` });
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async ({ hour, minute }: { hour: number; minute: number }) => {
      const r = await fetch(`${BASE}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ crawlHour: hour, crawlMinute: minute }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "저장 실패");
      return d;
    },
    onSuccess: () => {
      toast({ title: "크롤링 시간 저장 완료", description: `다음 날 ${String(scheduleHour).padStart(2,"0")}:${String(scheduleMinute).padStart(2,"0")} 부터 적용됩니다` });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });


  const metaTokenStatusQuery = useQuery<{ configured: boolean; valid: boolean; source?: string; expired?: boolean; userMsg?: string; devError?: string }>({
    queryKey: ["meta-token-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/meta-token/status`, { credentials: "include" });
      return r.json();
    },
    staleTime: 60_000,
    enabled: activeNav === "settings",
  });

  const saveMetaTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const r = await fetch(`${BASE}/api/admin/meta-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.userMsg ?? d.error ?? "저장 실패");
      return d;
    },
    onSuccess: () => {
      toast({ title: "✅ Meta 토큰 저장 완료", description: "새 토큰이 즉시 적용되었습니다." });
      setMetaTokenInput("");
      setMetaTokenOpen(false);
      qc.invalidateQueries({ queryKey: ["meta-token-status"] });
    },
    onError: (e: Error) => toast({ title: "토큰 저장 실패", description: e.message, variant: "destructive" }),
  });

  const saveBannerMutation = useMutation({
    mutationFn: async (cfg: typeof bannerForm) => {
      const r = await fetch(`${BASE}/api/banner-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(cfg),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "저장 실패");
      return d;
    },
    onSuccess: () => { toast({ title: "배너 설정 저장 완료" }); qc.invalidateQueries({ queryKey: ["banner-config"] }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const addSourceMutation = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) => {
      const r = await fetch(`${BASE}/api/sources`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name, url }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "추가 실패"); return d;
    },
    onSuccess: () => { toast({ title: "소스 추가 완료" }); setNewSourceName(""); setNewSourceUrl(""); qc.invalidateQueries({ queryKey: ["sources"] }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/sources/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("삭제 실패"); return r.json();
    },
    onSuccess: () => { toast({ title: "소스 삭제 완료" }); qc.invalidateQueries({ queryKey: ["sources"] }); },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await fetch(`${BASE}/api/sources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ enabled }) });
      if (!r.ok) throw new Error("상태 변경 실패"); return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  // ── Draft edit helpers ───────────────────────────────────────────────────────
  function cleanCaption(raw: string): string {
    return raw
      .split("\n")
      .filter((l) => !/^🔗|^🏠 PLAY강릉/.test(l.trim()))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getDraftEdit(ev: Event) {
    if (draftEdits[ev.id]) return draftEdits[ev.id];
    return {
      caption: cleanCaption(ev.socialDraft?.caption ?? ""),
      hashtagsStr: ev.socialDraft?.hashtags.join(" ") ?? "",
    };
  }
  function setDraftCaption(id: string, caption: string) {
    setDraftEdits((p) => ({ ...p, [id]: { ...getDraftEditById(id), caption } }));
  }
  function setDraftHashtagsStr(id: string, hashtagsStr: string) {
    setDraftEdits((p) => ({ ...p, [id]: { ...getDraftEditById(id), hashtagsStr } }));
  }
  function getDraftEditById(id: string) {
    return draftEdits[id] ?? { caption: "", hashtagsStr: "" };
  }
  function initDraftEdit(ev: Event) {
    if (!draftEdits[ev.id]) {
      setDraftEdits((p) => ({
        ...p,
        [ev.id]: {
          caption: cleanCaption(ev.socialDraft?.caption ?? ""),
          hashtagsStr: ev.socialDraft?.hashtags.join(" ") ?? "",
        },
      }));
    }
  }
  function parseHashtags(str: string): string[] {
    return str.split(/[\s,]+/).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  }
  function copyText(ev: Event) {
    if (!ev.socialDraft) return;
    const clean = cleanCaption(ev.socialDraft.caption);
    const hashtags = ev.socialDraft.hashtags.map((h) => `#${h}`).join(" ");
    const url = `${window.location.origin}/content/${ev.id}`;
    navigator.clipboard.writeText(
      `${clean}\n\n${hashtags}\n\n🔗 자세히 보기 → ${url}\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`
    ).then(() => toast({ title: "복사됨" }));
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-sidebar text-sidebar-foreground ${mobile ? "w-64" : "w-56"}`}>
      <div className="p-5 border-b border-sidebar-border">
        <div className="inline-block bg-white rounded-lg px-2 py-1">
          <img src={`${BASE}/logo_transparent.png`} alt="PLAY강릉" className="h-7 object-contain" />
        </div>
        <p className="text-xs text-sidebar-foreground/50 mt-1">관리자</p>
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
        <a href={`${BASE}/`} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
          <ExternalLink className="w-3 h-3" />공개 홈페이지
        </a>
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="w-3 h-3" />{logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex flex-shrink-0"><Sidebar /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full"><Sidebar mobile /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-md hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">{NAV_ITEMS.find((n) => n.key === activeNav)?.label}</h1>
              <p className="text-xs text-muted-foreground">PLAY강릉 백오피스</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="outline"
              className="hidden md:inline-flex gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => { setMobilePreviewPath("/"); setShowMobilePreview(true); }}
            >
              <Smartphone className="w-3.5 h-3.5" />모바일 보기
            </Button>
            <Button
              size="sm" variant="outline"
              className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => { resetManualDialog(); setShowManualDialog(true); }}
            >
              <PlusCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">새 피드 등록</span>
            </Button>
            <Button size="sm" onClick={() => crawlMutation.mutate()} disabled={crawlMutation.isPending} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${crawlMutation.isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{crawlMutation.isPending ? "크롤링 중..." : "전체 크롤링"}</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* ══ 대시보드: 수집 목차 ══════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-2">
              {/* 검색·필터 바 */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="제목·소스 검색..."
                    value={eventsSearch}
                    onChange={(e) => setEventsSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {(["all", "submitted", "pending", "draft", "approved", "published", "rejected"] as const).map((s) => {
                    const submittedCount = s === "submitted" ? allEvents.filter(e => e.status === "submitted").length : 0;
                    const hasNewTips = s === "submitted" && submittedCount > 0;
                    return (
                      <button
                        key={s}
                        onClick={() => setEventsStatusFilter(s)}
                        className={`relative px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          eventsStatusFilter === s ? "bg-blue-600 text-white" :
                          hasNewTips ? "bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200" :
                          "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {s === "all" ? `전체(${allEvents.length})` : `${STATUS_CONFIG[s]?.label ?? s}(${allEvents.filter(e => e.status === s).length})`}
                        {hasNewTips && eventsStatusFilter !== s && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* 미처리 제보 알림 배너 */}
              {allEvents.filter(e => e.status === "submitted").length > 0 && eventsStatusFilter !== "submitted" && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
                  onClick={() => setEventsStatusFilter("submitted")}
                >
                  <Inbox className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-xs font-semibold text-purple-700">미처리 제보 {allEvents.filter(e => e.status === "submitted").length}건 — 클릭하여 확인</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    checked={events.length > 0 && selectedIds.size === events.length}
                    ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < events.length; }}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(events.map((ev) => ev.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                  {selectedIds.size > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600">{selectedIds.size}개 선택됨</span>
                      <button
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                        disabled={bulkApproveMutation.isPending || bulkDeleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`선택한 ${selectedIds.size}개를 승인할까요?`))
                            bulkApproveMutation.mutate([...selectedIds]);
                        }}
                      >
                        <Check className="w-3 h-3" />선택 승인
                      </button>
                      <button
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                        disabled={bulkDeleteMutation.isPending || bulkApproveMutation.isPending}
                        onClick={() => {
                          if (confirm(`선택한 ${selectedIds.size}개를 삭제할까요?`))
                            bulkDeleteMutation.mutate([...selectedIds]);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />선택 삭제
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      수집된 콘텐츠 <span className="font-semibold text-foreground">{events.length}건</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={eventsImgRefetching}
                    onClick={async () => {
                      setEventsImgRefetching(true);
                      try {
                        const body: { ids?: string[] } = {};
                        if (selectedIds.size > 0) body.ids = [...selectedIds];
                        const r = await fetch(`${BASE}/api/events/refetch-images`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify(body),
                        });
                        const d = await r.json() as { message?: string; updated?: number };
                        toast({ description: d.message ?? "완료" });
                        if ((d.updated ?? 0) > 0) qc.invalidateQueries({ queryKey: ["admin-events"] });
                      } finally {
                        setEventsImgRefetching(false);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 transition-colors disabled:opacity-50"
                  >
                    {eventsImgRefetching
                      ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />처리 중...</>
                      : <><ImageIcon className="w-3 h-3" />{selectedIds.size > 0 ? `이미지 재추출 (${selectedIds.size})` : "이미지 재추출"}</>
                    }
                  </button>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
                    <button
                      onClick={() => setAdminSortBy("date")}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${adminSortBy === "date" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >날짜순</button>
                    <button
                      onClick={() => setAdminSortBy("latest")}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${adminSortBy === "latest" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >최신순</button>
                  </div>
                </div>
              </div>
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground text-sm">불러오는 중...</div>
              ) : events.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <LayoutDashboard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  수집된 콘텐츠가 없습니다. 상단의 전체 크롤링 버튼을 눌러 수집하세요.
                </div>
              ) : (
                events.map((ev) => {
                  const sc = STATUS_CONFIG[ev.status];
                  return (
                    <div key={ev.id} className={`flex items-center gap-2 rounded-xl border bg-white hover:border-blue-300 hover:shadow-sm transition-all group ${selectedIds.has(ev.id) ? "border-blue-400 bg-blue-50/40" : "border-border"}`}>
                      {/* 체크박스 */}
                      <div className="pl-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                          checked={selectedIds.has(ev.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(ev.id);
                              else next.delete(ev.id);
                              return next;
                            });
                          }}
                        />
                      </div>
                      {/* 클릭 영역 → 상세 이동 */}
                      <div
                        className="flex items-center gap-3 px-2 py-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/admin/events/${ev.id}`)}
                      >
                        {/* Thumbnail — 클릭 시 이미지 변경 */}
                        <button
                          type="button"
                          title="이미지 변경"
                          className="relative w-14 h-14 rounded-lg overflow-hidden bg-teal-50 shrink-0 group border-2 border-dashed border-transparent hover:border-blue-400 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setTop5ThumbEdit({ eventId: ev.id, title: ev.title }); setTop5ThumbInput(ev.thumbnail ?? ""); }}
                        >
                          <img
                            key={ev.thumbnail || ev.id}
                            src={proxyAdminImg(ev.thumbnail || extractYoutubeThumb(ev.videoUrl) || `${BASE}/logo_transparent.png`)}
                            alt=""
                            className={`w-full h-full ${(ev.thumbnail || extractYoutubeThumb(ev.videoUrl)) ? "object-cover" : "object-contain p-1.5"}`}
                            onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) { const raw = ev.thumbnail || extractYoutubeThumb(ev.videoUrl); img.src = raw || `${BASE}/logo_transparent.png`; img.className = `w-full h-full ${raw ? "object-cover" : "object-contain p-1.5"}`; } else { img.src = `${BASE}/logo_transparent.png`; img.className = "w-full h-full object-contain p-1.5"; } }}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ImageIcon className="w-4 h-4 text-white" />
                          </div>
                        </button>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border font-semibold ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </span>
                            {ev.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ev.category}</Badge>}
                          </div>
                          <p className="font-medium text-sm leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">{ev.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ev.description || "설명 없음"}</p>
                        </div>
                        {/* Date + Arrow */}
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">{ev.date}</p>
                          <p className="text-[10px] text-muted-foreground/60">{ev.source}</p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 ml-auto mt-1" />
                        </div>
                      </div>
                      {/* 삭제 버튼 */}
                      <button
                        className="shrink-0 pr-3 text-gray-300 hover:text-red-500 transition-colors"
                        title="삭제"
                        onClick={() => { if (confirm(`"${ev.title}" 을 삭제할까요?`)) deleteMutation.mutate(ev.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══ SNS 피드 만들기 (removed) ══════════════════════════════════════ */}
          {false && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground mb-1">
                승인된 콘텐츠 <span className="font-semibold text-foreground">{feedEvents.length}건</span> — 초안을 작성하고 수정한 뒤 카드이미지를 생성하세요.
              </p>
              {feedEvents.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <Rss className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  승인된 콘텐츠가 없습니다. 대시보드에서 항목을 승인하세요.
                </div>
              )}
              {feedEvents.map((ev) => {
                const edit = getDraftEdit(ev);
                const isDirty = !!draftEdits[ev.id];
                return (
                  <Card key={ev.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Header row */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gray-50/60">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-teal-50 shrink-0">
                          <img
                            key={ev.thumbnail || ev.id}
                            src={proxyAdminImg(ev.thumbnail || extractYoutubeThumb(ev.videoUrl) || `${BASE}/logo_transparent.png`)}
                            alt=""
                            className={`w-full h-full ${(ev.thumbnail || extractYoutubeThumb(ev.videoUrl)) ? "object-cover" : "object-contain p-1"}`}
                            onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) { const raw = ev.thumbnail || extractYoutubeThumb(ev.videoUrl); img.src = raw || `${BASE}/logo_transparent.png`; img.className = `w-full h-full ${raw ? "object-cover" : "object-contain p-1"}`; } else { img.src = `${BASE}/logo_transparent.png`; img.className = "w-full h-full object-contain p-1"; } }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-1">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">{ev.date} · {ev.source}</p>
                        </div>
                        {ev.link && (
                          <a href={ev.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600">
                              <ExternalLink className="w-3 h-3" />원문
                            </Button>
                          </a>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-4 space-y-3">
                        {!ev.socialDraft ? (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">SNS 초안이 없습니다.</p>
                            <Button
                              size="sm"
                              onClick={() => draftMutation.mutate(ev.id)}
                              disabled={draftMutation.isPending}
                              className="gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {draftMutation.isPending ? "생성 중..." : "초안 생성"}
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* SNS 문구 + 링크 버튼 통합 박스 */}
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">SNS 문구</Label>
                              <div className="rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                                <textarea
                                  rows={5}
                                  value={edit.caption}
                                  className="w-full text-sm resize-none p-3 outline-none bg-background leading-relaxed"
                                  onClick={() => initDraftEdit(ev)}
                                  onChange={(e) => { initDraftEdit(ev); setDraftCaption(ev.id, e.target.value); }}
                                />
                                <div className="border-t border-input flex">
                                  <a
                                    href={`${window.location.origin}/content/${ev.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 transition-colors"
                                  >
                                    🔗 자세히 보기
                                  </a>
                                  <a
                                    href="https://playgangneung.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-semibold py-2.5 transition-colors"
                                  >
                                    🏠 PLAY강릉 바로가기
                                  </a>
                                </div>
                              </div>
                            </div>
                            {/* Editable hashtags */}
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">해시태그 (공백 또는 쉼표로 구분)</Label>
                              <Input
                                value={edit.hashtagsStr}
                                className="text-sm"
                                placeholder="#강릉 #강릉여행 ..."
                                onClick={() => initDraftEdit(ev)}
                                onChange={(e) => { initDraftEdit(ev); setDraftHashtagsStr(ev.id, e.target.value); }}
                              />
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant={isDirty ? "default" : "outline"}
                                className={`gap-1.5 ${isDirty ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                disabled={saveDraftMutation.isPending || !isDirty}
                                onClick={() => saveDraftMutation.mutate({
                                  id: ev.id,
                                  caption: edit.caption,
                                  hashtags: parseHashtags(edit.hashtagsStr),
                                })}
                              >
                                {saveDraftMutation.isPending ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => copyText(ev)}
                              >
                                <Copy className="w-3 h-3" />문구 복사
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ 발행하기 (removed) ════════════════════════════════════════════ */}
          {false && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground mb-1">
                발행 준비 완료 <span className="font-semibold text-foreground">{publishEvents.length}건</span> — SNS 초안이 완성된 항목입니다.
              </p>
              {publishEvents.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>발행 준비된 콘텐츠가 없습니다.</p>
                  <p className="text-xs mt-1">SNS 피드 만들기에서 초안을 먼저 작성하세요.</p>
                </div>
              )}
              {publishEvents.map((ev) => {
                const fullText = ev.socialDraft
                  ? `${ev.socialDraft.caption}\n\n${ev.socialDraft.hashtags.map((h) => `#${h}`).join(" ")}`
                  : "";
                const isPublished = ev.status === "published";
                return (
                  <Card key={ev.id} className={isPublished ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{ev.title}</p>
                              <p className="text-xs text-muted-foreground">{ev.date} · {ev.source}</p>
                            </div>
                            {isPublished && (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">
                                <Send className="w-3 h-3" />발행완료
                              </span>
                            )}
                          </div>
                          {ev.socialDraft && (
                            <p className="text-xs text-muted-foreground line-clamp-3 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
                              {ev.socialDraft.caption}
                            </p>
                          )}
                          {!isPublished && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <a
                                href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" className="h-8 px-3 text-xs gap-1.5 text-white bg-[#1877F2] hover:bg-[#1565C0]">
                                  페이스북
                                </Button>
                              </a>
                              <a
                                href="https://www.instagram.com/playgangneung/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" className="h-8 px-3 text-xs gap-1.5 text-white bg-[#E1306C] hover:bg-[#C2185B]">
                                  인스타그램
                                </Button>
                              </a>
                              <a
                                href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" className="h-8 px-3 text-xs gap-1.5 text-white bg-[#3b5bdb] hover:bg-[#2f4ac4]">
                                  🏢 Meta Suite
                                </Button>
                              </a>
                              <a
                                href="https://www.youtube.com/@playgangneung"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" className="h-8 px-3 text-xs gap-1.5 text-white bg-[#FF0000] hover:bg-[#CC0000]">
                                  유튜브
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs gap-1.5 bg-gray-800 hover:bg-gray-900"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: ev.id, status: "published" }, {
                                  onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-events"] }),
                                })}
                              >
                                <Send className="w-3 h-3" />발행완료
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ 광고센터 ════════════════════════════════════════════════════ */}
          {activeNav === "adCenter" && (() => {
            const stats = adCenterStatsData?.stats;
            const alerts = adCenterAlertsData?.alerts ?? [];
            const pools = adPoolsData?.pools ?? [];
            const approvedAds = ads.filter((a) => a.status === "approved" || a.status === "pending" || a.status === "scheduled" || a.status === "published");

            const POOL_STATUS_CFG: Record<string, { label: string; cls: string }> = {
              draft:  { label: "초안", cls: "bg-gray-100 text-gray-600 border-gray-200" },
              active: { label: "운영중", cls: "bg-green-100 text-green-700 border-green-200" },
              paused: { label: "일시정지", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
              ended:  { label: "종료", cls: "bg-red-100 text-red-600 border-red-200" },
            };
            const OBJECTIVE_LABEL: Record<string, string> = {
              awareness:            "팔로워·방문 늘리기",
              messages:             "메시지 수신 늘리기",
              post_engagement:      "Facebook 콘텐츠 홍보",
              instagram_engagement: "Instagram 콘텐츠 홍보",
              page_likes:           "페이지 좋아요 늘리기",
              traffic:              "웹사이트 방문자 늘리기",
              engagement:           "참여/반응",
              conversion:           "전환/신청",
            };
            const ROTATION_MODE_CFG: Record<string, { label: string; cls: string; icon: string }> = {
              equal:       { label: "균등 노출", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: "⚖️" },
              performance: { label: "성과 최적화", cls: "bg-orange-100 text-orange-700 border-orange-200", icon: "⚡" },
            };
            const AI_MODE_LABEL: Record<string, string> = {
              equal: "균등 분배",
              performance: "성과 기반",
              overexposure_prevention: "과노출 방지",
              new_ad_boost: "신규 광고 보정",
              manual: "수동",
            };

            const SUB_TABS = [
              { key: "overview",      label: "대시보드",   icon: <BarChart2 className="w-3.5 h-3.5" />,        stub: false },
              { key: "applications",  label: "신청목록",   icon: <Megaphone className="w-3.5 h-3.5" />,        stub: false },
              { key: "createPool",    label: "묶음만들기", icon: <Layers className="w-3.5 h-3.5" />,           stub: false },
              { key: "rotation",      label: "순환편성표", icon: <CalendarClock className="w-3.5 h-3.5" />,    stub: false },
              { key: "meta",          label: "Meta연동",   icon: <ExternalLink className="w-3.5 h-3.5" />,     stub: false },
              { key: "monitoring",    label: "성과모니터링", icon: <Activity className="w-3.5 h-3.5" />,       stub: false },
              { key: "performance",   label: "성과리포트", icon: <TrendingUp className="w-3.5 h-3.5" />,       stub: false },
              { key: "billing",       label: "정산관리",   icon: <CircleDollarSign className="w-3.5 h-3.5" />, stub: false },
            ] as const;

            return (
              <div className="space-y-4">
                {/* 서브탭 */}
                <div className="flex items-center gap-1 flex-wrap border-b pb-3">
                  {SUB_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setAdCenterTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        adCenterTab === t.key
                          ? "bg-blue-600 text-white"
                          : t.stub
                          ? "bg-gray-50 text-gray-400 border border-dashed border-gray-300 hover:bg-gray-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {t.icon}{t.label}
                      {t.stub && <span className="text-[9px] ml-0.5 opacity-60">준비중</span>}
                    </button>
                  ))}
                </div>

                {/* ─ 대시보드 ─ */}
                {adCenterTab === "overview" && (
                  <div className="space-y-4">
                    {/* 통계 카드 5개 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "총 광고 수", value: stats?.total ?? 0, icon: <Megaphone className="w-4 h-4 text-blue-500" />, cls: "text-blue-700" },
                        { label: "운영중", value: stats?.active ?? 0, icon: <TrendingUp className="w-4 h-4 text-green-500" />, cls: "text-green-700" },
                        { label: "접수대기", value: stats?.pending ?? 0, icon: <Clock className="w-4 h-4 text-yellow-500" />, cls: "text-yellow-700" },
                        { label: "검수필요", value: stats?.needsReview ?? 0, icon: <AlertTriangle className="w-4 h-4 text-red-500" />, cls: "text-red-700" },
                      ].map((c) => (
                        <Card key={c.label}>
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="shrink-0">{c.icon}</div>
                            <div>
                              <p className="text-xs text-muted-foreground">{c.label}</p>
                              <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {/* 예산 + 풀 현황 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                          <CircleDollarSign className="w-5 h-5 text-indigo-500 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">오늘 운영 예산 합계</p>
                            <p className="text-xl font-bold text-indigo-700">{((stats?.todayBudget ?? 0) / 10000).toFixed(0)}만원</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                          <Layers className="w-5 h-5 text-purple-500 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">운영중 캠페인 묶음</p>
                            <p className="text-xl font-bold text-purple-700">{stats?.activePools ?? 0}개</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                          <BarChart2 className="w-5 h-5 text-orange-500 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">준비 중 묶음</p>
                            <p className="text-xl font-bold text-orange-700">{stats?.draftPools ?? 0}개</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* AI 알림 패널 */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-blue-600" />
                        <p className="font-semibold text-sm">AI 알림</p>
                        {alerts.length > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-bold border border-red-200">{alerts.length}</span>
                        )}
                      </div>
                      {alerts.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl bg-gray-50">
                          <Check className="w-6 h-6 mx-auto mb-1 text-green-500" />알림이 없습니다
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {alerts.map((a, i) => (
                            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                              a.level === "error" ? "bg-red-50 border-red-200 text-red-800" :
                              a.level === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                              "bg-blue-50 border-blue-200 text-blue-800"
                            }`}>
                              {a.level === "error" ? <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> :
                               a.level === "warning" ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> :
                               <Bell className="w-4 h-4 shrink-0 mt-0.5" />}
                              <span>{a.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 공동캠페인 상태 카드 */}
                    {pools.length > 0 && (
                      <div>
                        <p className="font-semibold text-sm mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500" />캠페인 묶음</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {pools.slice(0, 6).map((pool) => {
                            const sc = POOL_STATUS_CFG[pool.status] ?? POOL_STATUS_CFG.draft;
                            return (
                              <Card key={pool.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedPoolId(pool.id); setAdCenterTab("rotation"); }}>
                                <CardContent className="p-3 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border font-medium ${sc.cls}`}>{sc.label}</span>
                                      <span className="text-[10px] text-muted-foreground">{OBJECTIVE_LABEL[pool.objective] ?? pool.objective}</span>
                                      {pool.rotationMode && (
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border font-medium ${(ROTATION_MODE_CFG[pool.rotationMode] ?? ROTATION_MODE_CFG.equal).cls}`}>
                                          {(ROTATION_MODE_CFG[pool.rotationMode] ?? ROTATION_MODE_CFG.equal).icon} {(ROTATION_MODE_CFG[pool.rotationMode] ?? ROTATION_MODE_CFG.equal).label}
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-semibold text-sm line-clamp-1">{pool.name}</p>
                                    <p className="text-xs text-muted-foreground">{pool.startDate} ~ {pool.endDate} · {pool.adIds.length}개 광고</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                        {pools.length > 6 && (
                          <button onClick={() => setAdCenterTab("rotation")} className="mt-2 text-xs text-blue-600 hover:underline w-full text-center">
                            전체 {pools.length}개 보기 →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─ 신청목록 ─ */}
                {adCenterTab === "applications" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">
                      광고 신청 목록 <span className="font-semibold text-foreground">{ads.length}건</span>
                    </p>
                    {adsLoading ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
                    ) : ads.length === 0 ? (
                      <div className="py-16 text-center text-sm text-muted-foreground">
                        <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />접수된 광고가 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50 text-xs text-muted-foreground">
                              <th className="px-3 py-2.5 text-left font-medium">업체명</th>
                              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">카테고리</th>
                              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">기간</th>
                              <th className="px-3 py-2.5 text-left font-medium">상태</th>
                              <th className="px-3 py-2.5 text-right font-medium">액션</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {ads.map((ad) => {
                              const sc = AD_STATUS[ad.status] ?? AD_STATUS.pending;
                              return (
                                <React.Fragment key={ad.id}>
                                <tr className="hover:bg-gray-50 transition-colors">
                                  <td className="px-3 py-2.5">
                                    <div>
                                      <p className="font-medium line-clamp-1">{ad.businessName || "—"}</p>
                                      <p className="text-xs text-muted-foreground line-clamp-1">{ad.title}</p>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 hidden md:table-cell">
                                    <Badge variant="outline" className="text-xs">{ad.category}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5 hidden md:table-cell">
                                    <span className="text-xs text-muted-foreground">{ad.date || "—"}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.label}</span>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1 justify-end flex-wrap">
                                      {ad.status === "pending" && (
                                        <>
                                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200"
                                            onClick={() => adStatusMutation.mutate({ id: ad.id, status: "approved" })}>
                                            <CheckCircle className="w-3 h-3" />승인
                                          </Button>
                                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-200"
                                            onClick={() => adStatusMutation.mutate({ id: ad.id, status: "rejected" })}>
                                            <XCircle className="w-3 h-3" />반려
                                          </Button>
                                        </>
                                      )}
                                      {ad.status === "approved" && (
                                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-purple-700 border-purple-200"
                                          onClick={() => {
                                            setPoolForm((p) => ({
                                              ...p,
                                              selectedAdIds: p.selectedAdIds.includes(ad.id) ? p.selectedAdIds : [...p.selectedAdIds, ad.id],
                                            }));
                                            setAdCenterTab("createPool");
                                            toast({ description: `${ad.businessName} 을 묶음 만들기에 추가했습니다.` });
                                          }}>
                                          <Layers className="w-3 h-3" />공동광고추가
                                        </Button>
                                      )}
                                      {ad.metaAdId && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className={`h-7 px-2 text-xs ${ad.metaStatus === "ACTIVE" ? "text-green-700 border-green-300 bg-green-50 hover:bg-green-100" : "text-gray-500 border-gray-300 hover:bg-gray-50"}`}
                                          disabled={metaToggleLoading === ad.id}
                                          title={ad.metaStatus === "ACTIVE" ? "Meta 광고 일시정지" : "Meta 광고 활성화"}
                                          onClick={async () => {
                                            setMetaToggleLoading(ad.id);
                                            try {
                                              const r = await fetch(`${BASE}/api/ads/${ad.id}/meta-toggle`, { method: "POST", credentials: "include" });
                                              const d = await r.json() as { success?: boolean; metaStatus?: string; error?: string };
                                              if (!r.ok) {
                                                toast({ description: d.error ?? "Meta 상태 변경 실패", variant: "destructive" });
                                              } else {
                                                toast({ description: d.metaStatus === "ACTIVE" ? "✅ Meta 광고가 활성화되었습니다" : "⏸ Meta 광고가 일시정지되었습니다" });
                                                refetchAds();
                                              }
                                            } catch {
                                              toast({ description: "Meta 상태 변경 실패", variant: "destructive" });
                                            } finally {
                                              setMetaToggleLoading(null);
                                            }
                                          }}
                                        >
                                          {metaToggleLoading === ad.id ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                          ) : ad.metaStatus === "ACTIVE" ? (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1" />ON</>
                                          ) : (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block mr-1" />OFF</>
                                          )}
                                        </Button>
                                      )}
                                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedAd(ad)}>
                                        상세
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ 묶음 만들기 ─ */}
                {adCenterTab === "createPool" && (
                  <div className="max-w-2xl space-y-4">
                    <Card>
                      <CardContent className="p-5 space-y-4">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-600" />새 공동광고 묶음 만들기
                        </p>

                        {/* 묶음 이름 */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">묶음 이름 *</Label>
                          <Input
                            placeholder="예: 강릉 맛집 5월 공동광고"
                            value={poolForm.name}
                            onChange={(e) => setPoolForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>

                        {/* 광고 목적 — Meta 화면과 동일한 카드 구조 */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">캠페인 목표 선택</Label>
                          <p className="text-[11px] text-muted-foreground">Meta 광고 관리자와 동일한 목표로 캠페인이 생성됩니다.</p>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              {
                                value: "awareness",
                                label: "페이지 방문 수 및 팔로워 늘리기",
                                desc: "더 많은 사람이 페이지를 발견하고 팔로우하도록 광고를 만들어보세요",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5.657-3.657M9 20H4v-2a4 4 0 015.657-3.657M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0zm-18 0a3 3 0 116 0 3 3 0 01-6 0z" /></svg>
                                ),
                              },
                              {
                                value: "messages",
                                label: "메시지 수신 늘리기",
                                desc: "페이지의 행동 유도 버튼을 포함하는 광고를 만들어보세요.",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                ),
                              },
                              {
                                value: "post_engagement",
                                label: "Facebook 콘텐츠 홍보하기",
                                desc: "더 많은 사람이 게시물을 보고 참여하도록 유도하세요.",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                ),
                              },
                              {
                                value: "instagram_engagement",
                                label: "Instagram 콘텐츠 홍보하기",
                                desc: "더 많은 사람이 Instagram 게시물을 보고 참여하도록 유도하세요.",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1" viewBox="0 0 24 24" fill="url(#ig)"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                ),
                              },
                              {
                                value: "page_likes",
                                label: "페이지 좋아요 늘리기",
                                desc: "더 많은 사람이 페이지를 발견하고 좋아요를 누르도록 광고를 만들어보세요.",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                ),
                              },
                              {
                                value: "traffic",
                                label: "웹사이트 방문자 늘리기",
                                desc: "사람들을 웹사이트로 이동하도록 광고를 만듭니다.",
                                icon: (
                                  <svg className="w-6 h-6 mx-auto mb-1 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
                                ),
                              },
                            ] as { value: AdPool["objective"]; label: string; desc: string; icon: React.ReactNode }[]).map((o) => (
                              <label
                                key={o.value}
                                className={`flex flex-col items-center text-center p-3 rounded-xl border cursor-pointer transition-all select-none ${poolForm.objective === o.value ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
                              >
                                <input type="radio" name="objective" value={o.value} className="sr-only" checked={poolForm.objective === o.value} onChange={() => setPoolForm((p) => ({ ...p, objective: o.value }))} />
                                {o.icon}
                                <span className="text-[11px] font-semibold leading-tight text-gray-800 mb-1">{o.label}</span>
                                <span className="text-[10px] text-muted-foreground leading-tight">{o.desc}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 노출 방식 — 공정 균등 vs 성과 최적화 */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">노출 방식 <span className="text-blue-600 font-bold">*</span></Label>
                          <p className="text-[11px] text-muted-foreground">PLAY강릉 공동광고의 핵심 정책: 모든 광고주 공정 노출이 기본값입니다.</p>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              {
                                value: "equal",
                                icon: "⚖️",
                                label: "균등 노출 우선",
                                desc: "광고주별 독립 예산 집행 — Meta가 예산을 재배분하지 않아 모든 광고주가 동등하게 노출됩니다.",
                                badge: "기본값",
                                badgeCls: "bg-blue-600 text-white",
                                border: "border-blue-500 bg-blue-50 ring-1 ring-blue-400",
                                inactive: "border-gray-200 hover:border-blue-200 hover:bg-gray-50",
                              },
                              {
                                value: "performance",
                                icon: "⚡",
                                label: "성과 최적화 우선",
                                desc: "Meta 자동 최적화 — CTR이 높은 광고에 예산이 집중됩니다. 공정 노출을 보장하지 않습니다.",
                                badge: "권장 안함",
                                badgeCls: "bg-orange-500 text-white",
                                border: "border-orange-400 bg-orange-50 ring-1 ring-orange-300",
                                inactive: "border-gray-200 hover:border-orange-200 hover:bg-gray-50",
                              },
                            ] as { value: AdPool["rotationMode"]; icon: string; label: string; desc: string; badge: string; badgeCls: string; border: string; inactive: string }[]).map((m) => (
                              <label
                                key={m.value}
                                className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all select-none ${poolForm.rotationMode === m.value ? m.border : m.inactive}`}
                              >
                                <input type="radio" name="rotationMode" value={m.value} className="sr-only" checked={poolForm.rotationMode === m.value} onChange={() => setPoolForm((p) => ({ ...p, rotationMode: m.value }))} />
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base">{m.icon}</span>
                                  <span className="text-xs font-bold text-gray-800 flex-1">{m.label}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${m.badgeCls}`}>{m.badge}</span>
                                </div>
                                <span className="text-[11px] text-muted-foreground leading-tight">{m.desc}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 참여 광고 선택 + 개별 기간 설정 */}
                        {(() => {
                          // KST 기준 날짜 헬퍼
                          // KST(UTC+9) 내일 날짜 — UTC 오프셋 방식으로 정확하게 계산
                          const kstTomorrow = () =>
                            new Date(Date.now() + (9 + 24) * 3600 * 1000).toISOString().slice(0, 10);
                          // 날짜 문자열에 n일 추가 — Date.UTC로 타임존 완전 무관하게 계산
                          const addDays = (dateStr: string, n: number) => {
                            const [y, m, d] = dateStr.split("-").map(Number);
                            return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
                          };
                          const applyPreset = (adId: string, days: number) => {
                            setPoolForm((p) => {
                              const start = p.adDates[adId]?.startDate || kstTomorrow();
                              return { ...p, adDates: { ...p.adDates, [adId]: { startDate: start, endDate: addDays(start, days - 1) } } };
                            });
                          };
                          const setAdDate = (adId: string, field: "startDate" | "endDate", val: string) => {
                            setPoolForm((p) => ({ ...p, adDates: { ...p.adDates, [adId]: { ...p.adDates[adId], [field]: val } } }));
                          };

                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">참여 광고 선택 및 집행 기간</Label>
                                {poolForm.selectedAdIds.length > 0 && (
                                  <span className="text-[11px] text-purple-700 font-semibold">{poolForm.selectedAdIds.length}개 선택</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">광고를 선택하면 기간을 개별 설정할 수 있습니다. 기본값: 내일부터 7일</p>
                              {approvedAds.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 border rounded-lg px-3">승인된 광고가 없습니다. 먼저 광고를 승인하세요.</p>
                              ) : (
                                <div className="border rounded-xl divide-y overflow-hidden">
                                  {approvedAds.map((ad) => {
                                    const isSelected = poolForm.selectedAdIds.includes(ad.id);
                                    const adDate = poolForm.adDates[ad.id];
                                    return (
                                      <div key={ad.id} className={`transition-colors ${isSelected ? "bg-purple-50/60" : "bg-white hover:bg-gray-50/80"}`}>
                                        {/* 체크박스 행 */}
                                        <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 accent-purple-600 shrink-0"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              const tomorrow = kstTomorrow();
                                              setPoolForm((p) => {
                                                const newIds = e.target.checked
                                                  ? [...p.selectedAdIds, ad.id]
                                                  : p.selectedAdIds.filter((id) => id !== ad.id);
                                                const newDates = { ...p.adDates };
                                                if (e.target.checked && !newDates[ad.id]) {
                                                  newDates[ad.id] = { startDate: tomorrow, endDate: addDays(tomorrow, 6) };
                                                }
                                                if (!e.target.checked) delete newDates[ad.id];
                                                return { ...p, selectedAdIds: newIds, adDates: newDates };
                                              });
                                            }}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium line-clamp-1">{ad.businessName || ad.title}</p>
                                            <p className="text-[11px] text-muted-foreground">{ad.category} · {AD_STATUS[ad.status]?.label}</p>
                                          </div>
                                          {isSelected && adDate && (
                                            <span className="text-[11px] text-purple-600 font-medium shrink-0 hidden sm:block">
                                              {adDate.startDate} ~ {adDate.endDate}
                                            </span>
                                          )}
                                        </label>

                                        {/* 기간 설정 — 선택된 광고만 표시 */}
                                        {isSelected && (
                                          <div className="px-3 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                            {/* 프리셋 버튼 */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="text-[11px] text-muted-foreground font-medium">빠른 설정:</span>
                                              {([
                                                { label: "내일 1일", days: 1 },
                                                { label: "3일", days: 3 },
                                                { label: "7일", days: 7 },
                                                { label: "14일", days: 14 },
                                                { label: "30일", days: 30 },
                                              ]).map(({ label, days }) => (
                                                <button
                                                  key={days}
                                                  type="button"
                                                  className="text-[11px] px-2 py-0.5 rounded-full border border-purple-300 bg-white hover:bg-purple-50 text-purple-700 font-medium transition-colors"
                                                  onClick={() => applyPreset(ad.id, days)}
                                                >
                                                  {label}
                                                </button>
                                              ))}
                                            </div>
                                            {/* 날짜 직접 입력 */}
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 space-y-0.5">
                                                <p className="text-[10px] text-muted-foreground">시작일</p>
                                                <input
                                                  type="date"
                                                  className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:border-purple-400 focus:outline-none"
                                                  value={adDate?.startDate || ""}
                                                  onChange={(e) => {
                                                    const newStart = e.target.value;
                                                    setPoolForm((p) => {
                                                      const cur = p.adDates[ad.id];
                                                      const newEnd = cur?.endDate && cur.endDate >= newStart ? cur.endDate : addDays(newStart, 6);
                                                      return { ...p, adDates: { ...p.adDates, [ad.id]: { startDate: newStart, endDate: newEnd } } };
                                                    });
                                                  }}
                                                />
                                              </div>
                                              <span className="text-sm text-muted-foreground mt-4">~</span>
                                              <div className="flex-1 space-y-0.5">
                                                <p className="text-[10px] text-muted-foreground">종료일</p>
                                                <input
                                                  type="date"
                                                  className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:border-purple-400 focus:outline-none"
                                                  value={adDate?.endDate || ""}
                                                  min={adDate?.startDate || ""}
                                                  onChange={(e) => setAdDate(ad.id, "endDate", e.target.value)}
                                                />
                                              </div>
                                            </div>
                                            {adDate?.startDate && adDate?.endDate && (
                                              <p className="text-[11px] text-purple-600">
                                                📅 {adDate.startDate} ~ {adDate.endDate} ({Math.max(Math.round((new Date(adDate.endDate).getTime() - new Date(adDate.startDate).getTime()) / 86400000) + 1, 1)}일간 집행)
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 공동예산 */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">공동 예산 (원)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={10000}
                            placeholder="예: 500000"
                            value={poolForm.totalBudget || ""}
                            onChange={(e) => setPoolForm((p) => ({ ...p, totalBudget: parseInt(e.target.value) || 0 }))}
                          />
                          {poolForm.totalBudget > 0 && (
                            <p className="text-xs text-muted-foreground">= {(poolForm.totalBudget / 10000).toFixed(1)}만원</p>
                          )}
                        </div>

                        {/* 운영 기간 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">시작일</Label>
                            <Input type="date" value={poolForm.startDate} onChange={(e) => setPoolForm((p) => ({ ...p, startDate: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">종료일</Label>
                            <Input type="date" value={poolForm.endDate} onChange={(e) => setPoolForm((p) => ({ ...p, endDate: e.target.value }))} />
                          </div>
                        </div>

                        {/* AI 편성 방식 */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">AI 편성 방식</Label>
                          <div className="flex gap-2 flex-wrap">
                            {([
                              { value: "equal", label: "균등 분배", desc: "광고를 시간대별로 균등 배분" },
                              { value: "performance", label: "성과 기반", desc: "AI점수 높은 광고를 피크타임에 집중 배정" },
                              { value: "overexposure_prevention", label: "과노출 방지", desc: "동일 광고 연속 2시간 초과 금지, 강제 순환" },
                              { value: "new_ad_boost", label: "신규 광고 보정", desc: "최근 등록 광고를 피크타임에 우선 배정" },
                              { value: "manual", label: "수동", desc: "AI 기본 편성 후 직접 슬롯 조정" },
                            ] as { value: string; label: string; desc: string }[]).map((m) => (
                              <label key={m.value} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${poolForm.aiMode === m.value ? "bg-blue-50 border-blue-300" : "border-gray-200 hover:border-blue-200"}`}>
                                <input type="radio" name="aiMode" value={m.value} className="mt-0.5 accent-blue-600" checked={poolForm.aiMode === m.value} onChange={() => setPoolForm((p) => ({ ...p, aiMode: m.value as AdPool["aiMode"] }))} />
                                <div>
                                  <p className="font-medium">{m.label}</p>
                                  <p className="text-muted-foreground">{m.desc}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
                          disabled={!poolForm.name.trim() || poolForm.selectedAdIds.length === 0 || createPoolMutation.isPending}
                          onClick={() => {
                            // pool 전체 기간 = 개별 광고 날짜의 min/max (없으면 poolForm 날짜)
                            const allDates = Object.values(poolForm.adDates);
                            const derivedStart = allDates.length > 0
                              ? allDates.reduce((min, d) => d.startDate < min ? d.startDate : min, allDates[0].startDate)
                              : poolForm.startDate;
                            const derivedEnd = allDates.length > 0
                              ? allDates.reduce((max, d) => d.endDate > max ? d.endDate : max, allDates[0].endDate)
                              : poolForm.endDate;
                            createPoolMutation.mutate({
                              name: poolForm.name,
                              objective: poolForm.objective,
                              adIds: poolForm.selectedAdIds,
                              adDates: poolForm.adDates,
                              totalBudget: poolForm.totalBudget,
                              startDate: derivedStart,
                              endDate: derivedEnd,
                              aiMode: poolForm.aiMode,
                              rotationMode: poolForm.rotationMode,
                            } as AdPool);
                          }}
                        >
                          <Layers className="w-4 h-4" />
                          {createPoolMutation.isPending ? "생성 중..." : "묶음 저장"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ─ 순환편성표 ─ */}
                {adCenterTab === "rotation" && (
                  <div className="space-y-4">
                    {/* 묶음 선택 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground shrink-0">묶음 선택:</span>
                      {poolsLoading ? (
                        <span className="text-xs text-muted-foreground">불러오는 중...</span>
                      ) : pools.length === 0 ? (
                        <span className="text-xs text-muted-foreground">생성된 묶음이 없습니다. &ldquo;묶음 만들기&rdquo; 탭에서 먼저 생성하세요.</span>
                      ) : pools.map((pool) => {
                        const sc = POOL_STATUS_CFG[pool.status] ?? POOL_STATUS_CFG.draft;
                        return (
                          <button
                            key={pool.id}
                            onClick={() => setSelectedPoolId(pool.id)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${selectedPoolId === pool.id ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 hover:border-purple-300"}`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${sc.cls.includes("green") ? "bg-green-500" : sc.cls.includes("yellow") ? "bg-yellow-500" : sc.cls.includes("red") ? "bg-red-500" : "bg-gray-400"}`} />
                            {pool.name}
                          </button>
                        );
                      })}
                    </div>

                    {selectedPoolId && rotationData ? (() => {
                      const pool = rotationData.pool;
                      const slots = rotationData.slots;
                      const sc = POOL_STATUS_CFG[pool.status] ?? POOL_STATUS_CFG.draft;
                      const adIds = pool.adIds;
                      const poolAds = ads.filter((a) => adIds.includes(a.id));

                      return (
                        <div className="space-y-4">
                          {/* 묶음 정보 */}
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.label}</span>
                                    <span className="text-xs text-muted-foreground">{OBJECTIVE_LABEL[pool.objective]}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">AI: {AI_MODE_LABEL[pool.aiMode]}</span>
                                  </div>
                                  <p className="font-semibold">{pool.name}</p>
                                  <p className="text-xs text-muted-foreground">{pool.startDate} ~ {pool.endDate} · 예산 {(pool.totalBudget / 10000).toFixed(1)}만원 · {adIds.length}개 광고</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {pool.status !== "active" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200"
                                      onClick={() => poolStatusMutation.mutate({ id: pool.id, status: "active" })}>
                                      운영 시작
                                    </Button>
                                  )}
                                  {pool.status === "active" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-yellow-700 border-yellow-200"
                                      onClick={() => poolStatusMutation.mutate({ id: pool.id, status: "paused" })}>
                                      일시정지
                                    </Button>
                                  )}
                                  {pool.status !== "draft" && (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                      onClick={() => poolStatusMutation.mutate({ id: pool.id, status: "draft" })}>
                                      초안으로
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* 참여 광고 */}
                              {poolAds.length > 0 && (
                                <div className="mt-3 pt-3 border-t flex flex-wrap gap-1">
                                  {poolAds.map((a) => (
                                    <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
                                      {a.businessName || a.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* AI 편성표 생성 버튼 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                              disabled={generatingRotationId === pool.id}
                              onClick={() => handleGenerateRotation(pool.id)}
                            >
                              <Sparkles className={`w-3.5 h-3.5 ${generatingRotationId === pool.id ? "animate-spin" : ""}`} />
                              {generatingRotationId === pool.id ? "AI 편성 중..." : "AI 편성표 생성"}
                            </Button>
                            <span className="text-xs text-muted-foreground">전략: <span className="font-medium">{AI_MODE_LABEL[pool.aiMode]}</span> — AI가 24시간 슬롯을 자동 배정합니다</span>
                          </div>

                          {/* 24시간 편성표 */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                              <CalendarClock className="w-3.5 h-3.5" />24시간 순환 편성표
                            </p>
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                              {slots.map((slot) => {
                                const isActive = slot.status === "active";
                                const isBoost = slot.status === "boost";
                                const hasAd = !!slot.adId;
                                return (
                                  <div
                                    key={slot.hour}
                                    title={slot.aiReason ?? undefined}
                                    className={`rounded-lg border p-2 text-center cursor-default ${
                                      isBoost ? "bg-orange-50 border-orange-300" :
                                      hasAd && isActive ? "bg-purple-50 border-purple-200" :
                                      "bg-gray-50 border-gray-200"
                                    }`}
                                  >
                                    <p className="text-xs font-bold text-muted-foreground">{String(slot.hour).padStart(2, "0")}시</p>
                                    {hasAd ? (
                                      <>
                                        <p className="text-[10px] font-medium text-purple-700 line-clamp-2 mt-0.5">{slot.adName}</p>
                                        <span className={`inline-block mt-0.5 px-1 py-0.5 rounded text-[9px] font-semibold ${
                                          isBoost ? "bg-orange-100 text-orange-700"
                                          : isActive ? "bg-green-100 text-green-700"
                                          : slot.status === "scheduled" ? "bg-blue-50 text-blue-600"
                                          : slot.status === "reduce" ? "bg-yellow-50 text-yellow-700"
                                          : "bg-gray-100 text-gray-500"
                                        }`}>
                                          {isBoost ? "강화" : isActive ? "운영" : slot.status === "reduce" ? "축소" : "대기"}
                                        </span>
                                      </>
                                    ) : (
                                      <p className="text-[10px] text-gray-400 mt-0.5">미배정</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {slots.some((s) => s.aiReason) && (
                              <p className="text-[10px] text-muted-foreground mt-1.5">슬롯 위에 마우스를 올리면 AI 배정 근거를 확인할 수 있습니다</p>
                            )}
                          </div>
                        </div>
                      );
                    })() : selectedPoolId ? (
                      <div className="py-12 text-center text-sm text-muted-foreground">편성표 불러오는 중...</div>
                    ) : null}
                  </div>
                )}

                {/* ─ Meta 연동 탭 ─ */}
                {adCenterTab === "meta" && (() => {
                  const pools = adPoolsData?.pools ?? [];
                  return (
                    <div className="space-y-4">
                      {/* Meta API 상태 + Rate-limit 모니터링 패널 */}
                      <Card className={metaRateLimitData?.warning ? "border-yellow-300 bg-yellow-50" : metaRateLimitData?.configured ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold flex items-center gap-2">
                              {metaRateLimitData?.configured
                                ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">Meta Marketing API 연결됨</span></>
                                : <><ExternalLink className="w-4 h-4 text-blue-600" /><span className="text-blue-800">Meta Marketing API 미연결</span></>
                              }
                            </p>
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => refetchRateLimit()}>
                              <RefreshCw className="w-3 h-3" />새로고침
                            </Button>
                          </div>
                          {!metaRateLimitData?.configured && (
                            <p className="text-xs text-blue-700">
                              환경변수 <code className="bg-blue-100 px-1 rounded">META_ACCESS_TOKEN</code>과{" "}
                              <code className="bg-blue-100 px-1 rounded">META_AD_ACCOUNT_ID</code>를 설정하면 Meta 광고 캠페인을 자동 생성합니다.
                              미설정 시에도 관리 기능은 모두 사용 가능합니다.
                            </p>
                          )}
                          {metaRateLimitData?.configured && metaRateLimitData.rateLimit && (
                            <div className="space-y-1.5">
                              {metaRateLimitData.warning && (
                                <p className="text-xs font-medium text-yellow-800 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />{metaRateLimitData.warning}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground w-20 shrink-0">API 호출량</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${metaRateLimitData.rateLimit.callCount >= 80 ? "bg-red-500" : metaRateLimitData.rateLimit.callCount >= 50 ? "bg-yellow-500" : "bg-green-500"}`}
                                    style={{ width: `${Math.min(100, metaRateLimitData.rateLimit.callCount)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">{metaRateLimitData.rateLimit.callCount}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground w-20 shrink-0">CPU 시간</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${metaRateLimitData.rateLimit.totalCputime >= 80 ? "bg-red-500" : "bg-blue-400"}`}
                                    style={{ width: `${Math.min(100, metaRateLimitData.rateLimit.totalCputime)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">{metaRateLimitData.rateLimit.totalCputime}%</span>
                              </div>
                              {metaRateLimitData.rateLimit.estimatedTimeToRegain > 0 && (
                                <p className="text-[11px] text-yellow-700">한도 회복까지 약 {metaRateLimitData.rateLimit.estimatedTimeToRegain}분</p>
                              )}
                            </div>
                          )}
                          {metaRateLimitData?.configured && !metaRateLimitData.rateLimit && (
                            <p className="text-xs text-green-700">API 호출 기록 없음 — 한도 여유 충분</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* 풀별 Meta 연동 현황 */}
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">광고 묶음별 Meta 연동 현황</p>
                        {pools.length === 0 && (
                          <p className="text-xs text-muted-foreground py-6 text-center">등록된 광고 묶음이 없습니다. 먼저 묶음을 만드세요.</p>
                        )}
                        {pools.map((pool) => (
                          <Card key={pool.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm truncate">{pool.name}</span>
                                    <Badge className={`text-[10px] ${
                                      pool.status === "active" ? "bg-green-100 text-green-700 border-green-200"
                                      : pool.status === "paused" ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                      : pool.status === "ended" ? "bg-red-100 text-red-600 border-red-200"
                                      : "bg-gray-100 text-gray-600 border-gray-200"
                                    }`}>
                                      {pool.status === "active" ? "운영중" : pool.status === "paused" ? "일시정지" : pool.status === "ended" ? "종료" : "초안"}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    {pool.startDate} ~ {pool.endDate} · 예산 {pool.totalBudget.toLocaleString()}원 · 광고 {pool.adIds.length}개
                                  </p>
                                  {pool.metaCampaignId ? (
                                    <div className="mt-2 text-[11px] space-y-0.5">
                                      <p className="text-green-700 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        캠페인 생성 완료 — ID: <code className="bg-green-50 px-1 rounded font-mono">{pool.metaCampaignId}</code>
                                      </p>
                                      {pool.metaAdSetId && (
                                        <p className="text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />광고세트 생성 완료</p>
                                      )}
                                      {pool.metaSyncedAt && (
                                        <p className="text-muted-foreground">마지막 동기화: {new Date(pool.metaSyncedAt).toLocaleString("ko-KR")}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-yellow-500" />Meta 미연동
                                    </p>
                                  )}
                                  {/* 광고별 Meta 검수 상태 배지 */}
                                  {pool.adIds.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {pool.adIds.map((adId) => {
                                        const ad = adsData?.ads.find((a) => a.id === adId);
                                        if (!ad) return null;
                                        const s = ad.metaStatus;
                                        const { label, cls } = s === "ACTIVE"
                                          ? { label: "승인됨", cls: "bg-green-100 text-green-700 border-green-200" }
                                          : s === "DISAPPROVED"
                                          ? { label: "거부됨", cls: "bg-red-100 text-red-700 border-red-200" }
                                          : s === "PENDING_REVIEW" || s === "IN_REVIEW"
                                          ? { label: "검수 중", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" }
                                          : s === "WITH_ISSUES"
                                          ? { label: "문제 있음", cls: "bg-orange-100 text-orange-700 border-orange-200" }
                                          : s === "PAUSED"
                                          ? { label: "검수 대기", cls: "bg-gray-100 text-gray-600 border-gray-200" }
                                          : s
                                          ? { label: s, cls: "bg-gray-100 text-gray-500 border-gray-200" }
                                          : { label: "상태 미확인", cls: "bg-gray-100 text-gray-400 border-gray-200" };
                                        return (
                                          <div key={adId} className="flex items-center gap-1.5 text-[11px]">
                                            <span className="truncate max-w-[130px] text-muted-foreground">{ad.title || ad.businessName}</span>
                                            {ad.metaAdId ? (
                                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${cls}`}>{label}</Badge>
                                            ) : (
                                              <span className="text-[10px] text-muted-foreground italic">Meta Ad 없음</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                  {(() => {
                                    type AdResult = { adId: string; adName: string; metaAdId: string; metaCreativeId: string; metaImageHash: string; skipped: boolean; skipReason?: string; imageStep: string };
                                    type PushResult = { success?: boolean; error?: string; hint?: string; missingEnv?: string[]; metaCampaignId?: string; adsCreated?: number; adsSkipped?: number; adResults?: AdResult[]; steps?: { campaign?: { ok: boolean; id: string }; adSets?: { ok: boolean; count: number }; ads?: { created: number; skipped: number } }; failedStep?: string };
                                    const doPush = async (force = false) => {
                                      setMetaPushLoading(pool.id);
                                      try {
                                        const url = `${BASE}/api/ad-pools/${pool.id}/push-to-meta${force ? "?force=true" : ""}`;
                                        const r = await fetch(url, { method: "POST", credentials: "include" });
                                        const d = await r.json() as PushResult;
                                        if (!r.ok) {
                                          toast({ description: d.error ?? "Meta 반영 실패", variant: "destructive" });
                                          if (d.hint) toast({ description: `💡 ${d.hint}` });
                                          if (d.missingEnv) toast({ description: `누락 환경변수: ${d.missingEnv.join(", ")}`, variant: "destructive" });
                                        } else {
                                          const steps = d.steps;
                                          const lines: string[] = [];
                                          if (steps?.campaign?.ok) lines.push(`✅ 캠페인 생성 (${steps.campaign.id.slice(-8)})`);
                                          if (steps?.adSets?.ok) lines.push(`✅ 광고세트 ${steps.adSets.count}개 생성`);
                                          if (d.adsCreated !== undefined) lines.push(`✅ 광고 ${d.adsCreated}개 생성 완료`);
                                          if (d.adsSkipped && d.adsSkipped > 0) lines.push(`⏭ ${d.adsSkipped}개 스킵`);
                                          if (d.adResults) {
                                            const skipped = d.adResults.filter(a => a.skipped);
                                            skipped.forEach(a => toast({ description: `⚠️ [${a.adName}] ${a.skipReason}`, variant: "destructive" }));
                                          }
                                          toast({ description: lines.join(" | ") || "Meta 반영 완료" });
                                          refetchPools();
                                        }
                                      } catch {
                                        toast({ description: "Meta 반영 실패", variant: "destructive" });
                                      } finally {
                                        setMetaPushLoading(null);
                                      }
                                    };
                                    return (
                                      <>
                                        <Button
                                          size="sm"
                                          variant={pool.metaCampaignId ? "outline" : "default"}
                                          className={`text-xs ${!pool.metaCampaignId ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                          disabled={metaPushLoading === pool.id}
                                          onClick={() => doPush(false)}
                                        >
                                          {metaPushLoading === pool.id ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                                          {pool.metaCampaignId ? "재동기화" : "Meta에 반영"}
                                        </Button>
                                        {pool.metaCampaignId && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                                            disabled={metaPushLoading === pool.id}
                                            onClick={() => doPush(true)}
                                          >
                                            <RefreshCw className="w-3 h-3 mr-1" />Meta 광고 재생성
                                          </Button>
                                        )}
                                        {pool.metaCampaignId && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs"
                                            onClick={async () => {
                                              try {
                                                const r = await fetch(`${BASE}/api/ad-pools/${pool.id}/collect-performance`, {
                                                  method: "POST", credentials: "include",
                                                });
                                                const d = await r.json() as { success?: boolean; error?: string; saved?: number };
                                                if (!r.ok) toast({ description: d.error ?? "수집 실패", variant: "destructive" });
                                                else toast({ description: `성과 ${d.saved ?? 0}건 수집 완료` });
                                              } catch {
                                                toast({ description: "수집 실패", variant: "destructive" });
                                              }
                                            }}
                                          >
                                            <RefreshCw className="w-3 h-3 mr-1" />성과 수집
                                          </Button>
                                        )}
                                        {pool.metaCampaignId && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                                            disabled={metaStatusRefreshLoading === pool.id}
                                            onClick={async () => {
                                              setMetaStatusRefreshLoading(pool.id);
                                              try {
                                                const r = await fetch(`${BASE}/api/ad-pools/${pool.id}/refresh-meta-status`, {
                                                  method: "POST", credentials: "include",
                                                });
                                                const d = await r.json() as { success?: boolean; updated?: number; total?: number; error?: string; configured?: boolean };
                                                if (!r.ok) {
                                                  toast({ description: d.error ?? "검수 상태 조회 실패", variant: "destructive" });
                                                } else {
                                                  toast({ description: `검수 상태 갱신 완료 (${d.updated ?? 0}/${d.total ?? 0}개)` });
                                                  void refetchAds();
                                                }
                                              } catch {
                                                toast({ description: "검수 상태 조회 실패", variant: "destructive" });
                                              } finally {
                                                setMetaStatusRefreshLoading(null);
                                              }
                                            }}
                                          >
                                            {metaStatusRefreshLoading === pool.id
                                              ? <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                              : <RefreshCw className="w-3 h-3 mr-1" />
                                            }
                                            검수 상태 확인
                                          </Button>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Rate limit 안내 */}
                      <Card className="border-gray-200">
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                            <Bell className="w-3.5 h-3.5" />Meta API Rate Limit 안내
                          </p>
                          <ul className="text-[11px] text-muted-foreground space-y-1">
                            <li>• 성과 데이터는 매일 오전 8시 자동 수집됩니다 (Meta Business Basic tier: 200회/시간)</li>
                            <li>• 한도 초과 시 다음 수집 주기에 자동 재시도합니다</li>
                            <li>• 즉시 수집이 필요하면 "성과 수집" 버튼을 클릭하세요</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* ─ 성과 모니터링 탭 ─ */}
                {adCenterTab === "monitoring" && (() => {
                  const allInsights = metaInsightsData?.insights ?? [];
                  const summary = metaInsightsData?.summary;
                  const configured = metaInsightsData?.configured ?? true;

                  // ── 필터 적용 ──────────────────────────────────────────────
                  const insights = allInsights
                    .filter((ins) => monitoringHealthFilter === "all" || ins.healthStatus === monitoringHealthFilter)
                    .filter((ins) => {
                      if (monitoringPoolFilter === "all") return true;
                      if (monitoringPoolFilter === "none") return ins.pools.length === 0;
                      return ins.pools.some((p) => p.poolId === monitoringPoolFilter);
                    })
                    .sort((a, b) => {
                      const order = { critical: 0, warning: 1, ok: 2 };
                      return (order[a.healthStatus as keyof typeof order] ?? 2) - (order[b.healthStatus as keyof typeof order] ?? 2);
                    });

                  // ── 묶음 목록 (필터용) ──────────────────────────────────────
                  const allPools = Array.from(
                    new Map(
                      allInsights.flatMap((i) => i.pools).map((p) => [p.poolId, p])
                    ).values()
                  );

                  // ── 7단계 현재 스텝 판정 ──────────────────────────────────
                  const getCurrentStep = (ins: MonitoringInsight): number => {
                    if (ins.impressions === 0 && ins.status === "ACTIVE") return 1;
                    if (ins.impressions === 0) return 1;
                    const hasCtrIssue = ins.issues.some((i) => i.includes("CTR"));
                    const hasFreqIssue = ins.issues.some((i) => i.includes("Frequency"));
                    const hasCpcIssue = ins.issues.some((i) => i.includes("CPC"));
                    if (hasCtrIssue && ins.healthStatus === "critical") return 4;
                    if (hasCtrIssue) return 3;
                    if (hasCpcIssue) return 5;
                    if (hasFreqIssue) return 6;
                    if (ins.issues.length > 0) return 3;
                    return 7;
                  };

                  const CYCLE_STEPS = [
                    { n: 1, label: "광고 노출",    short: "노출" },
                    { n: 2, label: "CTR 측정",     short: "CTR" },
                    { n: 3, label: "원인 분석",    short: "분석" },
                    { n: 4, label: "제목 개선",    short: "제목" },
                    { n: 5, label: "이미지 개선",  short: "이미지" },
                    { n: 6, label: "시간대 최적화", short: "시간대" },
                    { n: 7, label: "재집행",        short: "재집행" },
                  ];

                  // ── 수집 핸들러 ────────────────────────────────────────────
                  const handleCollect = async () => {
                    setMonitoringCollectLoading(true);
                    try {
                      const r = await fetch(`${BASE}/api/meta/insights/collect`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ datePreset: monitoringDatePreset }),
                      });
                      const data = await r.json() as { saved?: number; error?: string };
                      if (!r.ok) throw new Error(data.error ?? "수집 실패");
                      toast({ title: "수집 완료", description: `${data.saved}건 저장됨` });
                      void refetchInsights();
                    } catch (e: unknown) {
                      toast({ title: "수집 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                    } finally {
                      setMonitoringCollectLoading(false);
                    }
                  };

                  // ── 초안 생성 핸들러 ───────────────────────────────────────
                  const handleDraft = async (internalAdId: string) => {
                    try {
                      const r = await fetch(`${BASE}/api/ads/${internalAdId}/draft`, { method: "POST", credentials: "include" });
                      if (!r.ok) throw new Error("초안 생성 실패");
                      toast({ title: "SNS 초안 생성 완료", description: "신청목록 탭에서 확인하세요." });
                    } catch (e: unknown) {
                      toast({ title: "초안 생성 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                    }
                  };

                  // ── 카드이미지 생성 핸들러 ─────────────────────────────────
                  const handleCard = async (internalAdId: string) => {
                    try {
                      const r = await fetch(`${BASE}/api/ads/${internalAdId}/card`, { method: "POST", credentials: "include" });
                      if (!r.ok) throw new Error("카드 생성 실패");
                      const d = await r.json() as { url?: string };
                      toast({ title: "카드이미지 생성 완료", description: d.url ? "이미지가 생성되었습니다." : "생성 완료" });
                    } catch (e: unknown) {
                      toast({ title: "카드 생성 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                    }
                  };

                  // ── 재집행(Meta push) 핸들러 ───────────────────────────────
                  const handleReLaunch = async (poolId: string) => {
                    try {
                      const r = await fetch(`${BASE}/api/ad-pools/${poolId}/push-to-meta`, { method: "POST", credentials: "include" });
                      if (!r.ok) throw new Error("Meta 전송 실패");
                      toast({ title: "Meta 재집행 요청 완료" });
                    } catch (e: unknown) {
                      toast({ title: "재집행 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
                    }
                  };

                  const PRESET_LABELS = { today: "오늘", yesterday: "어제", last_7d: "최근 7일", last_30d: "최근 30일" };

                  return (
                    <div className="space-y-4">

                      {/* ── 헤더 바 ─────────────────────────────────────── */}
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="font-semibold text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-500" />
                            광고 최적화 모니터링
                          </h3>
                          {summary?.lastCollectedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              마지막 수집: {new Date(summary.lastCollectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 날짜 프리셋 */}
                          <div className="flex rounded-md border overflow-hidden text-xs">
                            {(["today", "yesterday", "last_7d", "last_30d"] as const).map((p) => (
                              <button
                                key={p}
                                onClick={() => setMonitoringDatePreset(p)}
                                className={`px-2.5 py-1.5 border-r last:border-r-0 transition-colors ${monitoringDatePreset === p ? "bg-blue-600 text-white font-semibold" : "bg-white hover:bg-gray-50 text-gray-600"}`}
                              >
                                {PRESET_LABELS[p]}
                              </button>
                            ))}
                          </div>
                          <Button size="sm" onClick={handleCollect} disabled={monitoringCollectLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${monitoringCollectLoading ? "animate-spin" : ""}`} />
                            {monitoringCollectLoading ? "수집 중..." : "지금 수집"}
                          </Button>
                        </div>
                      </div>

                      {/* ── Meta 미설정 경고 ─────────────────────────────── */}
                      {!configured && (
                        <Card className="border-yellow-200 bg-yellow-50">
                          <CardContent className="p-3 flex items-center gap-2 text-sm text-yellow-800">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Meta API가 설정되지 않았습니다. Meta연동 탭에서 확인하세요.
                          </CardContent>
                        </Card>
                      )}

                      {/* ── 공정 노출 정책 안내 ───────────────────────────── */}
                      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <span className="text-xl shrink-0">⚖️</span>
                        <div className="text-xs text-blue-800 space-y-0.5">
                          <p className="font-semibold text-sm">PLAY강릉 공동광고 공정 노출 정책</p>
                          <p>모든 광고주는 설정된 기간 동안 <strong>균등하게 노출</strong>됩니다. 성과 낮은 광고는 <strong>자동 중단되지 않습니다.</strong></p>
                          <p className="text-blue-600">⚠️ 아래 경고는 소재 개선 권고사항이며, 광고 중단은 관리자가 직접 결정해야 합니다.</p>
                        </div>
                      </div>

                      {/* ── 요약 카드 ────────────────────────────────────── */}
                      {summary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          {[
                            { label: "전체 광고", value: summary.total, color: "text-gray-700", sub: null },
                            { label: "⭐ 반응 우수", value: summary.ok, color: "text-emerald-700", sub: null },
                            { label: "🟢 정상", value: summary.ok, color: "text-green-700", sub: null },
                            { label: "🟡 개선 필요", value: summary.warning, color: "text-yellow-700", sub: null },
                            { label: "🔴 매우 저조", value: summary.critical, color: "text-red-700", sub: null },
                            { label: "총 노출", value: summary.totalImpressions.toLocaleString(), color: "text-blue-700", sub: "회" },
                            { label: "총 지출", value: `₩${Math.round(summary.totalSpend).toLocaleString()}`, color: "text-orange-700", sub: null },
                          ].map(({ label, value, color, sub }) => (
                            <Card key={label}>
                              <CardContent className="p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                                <p className={`text-lg font-bold mt-0.5 leading-tight ${color}`}>{value}</p>
                                {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* ── 필터 바 ──────────────────────────────────────── */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          className="text-xs border rounded-md px-2 py-1.5 bg-white"
                          value={monitoringHealthFilter}
                          onChange={(e) => setMonitoringHealthFilter(e.target.value as typeof monitoringHealthFilter)}
                        >
                          <option value="all">전체 상태</option>
                          <option value="critical">🔴 위험만</option>
                          <option value="warning">🟡 주의만</option>
                          <option value="ok">🟢 정상만</option>
                        </select>
                        <select
                          className="text-xs border rounded-md px-2 py-1.5 bg-white"
                          value={monitoringPoolFilter}
                          onChange={(e) => setMonitoringPoolFilter(e.target.value)}
                        >
                          <option value="all">전체 묶음</option>
                          <option value="none">묶음 미배정</option>
                          {allPools.map((p) => (
                            <option key={p.poolId} value={p.poolId}>{p.poolName}</option>
                          ))}
                        </select>
                        {(monitoringHealthFilter !== "all" || monitoringPoolFilter !== "all") && (
                          <button
                            className="text-xs text-blue-600 underline"
                            onClick={() => { setMonitoringHealthFilter("all"); setMonitoringPoolFilter("all"); }}
                          >
                            필터 초기화
                          </button>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{insights.length}개 광고</span>
                      </div>

                      {/* ── 광고별 최적화 사이클 카드 ───────────────────── */}
                      {metaInsightsLoading ? (
                        <div className="py-16 text-center text-muted-foreground text-sm">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                          데이터 로딩 중...
                        </div>
                      ) : insights.length === 0 ? (
                        <Card>
                          <CardContent className="p-10 text-center text-sm text-muted-foreground">
                            <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="font-medium">수집된 데이터가 없습니다</p>
                            <p className="mt-1 text-xs">"지금 수집" 버튼을 눌러 Meta에서 데이터를 가져오세요.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {insights.map((ins) => {
                            const isExpanded = monitoringExpandedAd === ins.adId;
                            const currentStep = getCurrentStep(ins);
                            const isOk = ins.healthStatus === "ok";

                            // ── PLAY강릉 4단계 공정 노출 상태 ────────────────
                            const ctr = ins.ctr ?? 0;
                            const hasEnoughData = ins.impressions >= 1000;
                            const playStatus = !hasEnoughData
                              ? { level: "normal", label: "정상", badge: "🟢", color: "text-green-700", bg: "bg-green-50/40", border: "border-green-200" }
                              : ctr >= 2
                              ? { level: "excellent", label: "반응 우수", badge: "⭐", color: "text-emerald-700", bg: "bg-emerald-50/40", border: "border-emerald-300" }
                              : ctr >= 0.7
                              ? { level: "normal", label: "정상", badge: "🟢", color: "text-green-700", bg: "bg-green-50/40", border: "border-green-200" }
                              : ctr >= 0.3
                              ? { level: "warning", label: "개선 필요", badge: "🟡", color: "text-yellow-700", bg: "bg-yellow-50/40", border: "border-yellow-300" }
                              : { level: "critical", label: "매우 저조", badge: "🔴", color: "text-red-700", bg: "bg-red-50/40", border: "border-red-300" };

                            // ── 경고 태그 (소재 개선 권고, 자동 중단 없음) ────
                            const adWarnings: string[] = [];
                            if (hasEnoughData) {
                              if (ctr < 0.7) adWarnings.push("⚠️ CTR 낮음");
                              if (ctr < 0.3 && ins.impressions > 0) adWarnings.push("⚠️ 문구 반응 저조");
                              if (ins.impressions > 3000 && (ins.clicks ?? 0) < 5) adWarnings.push("⚠️ 이미지 품질 낮음 가능성");
                            }
                            if (ins.impressions === 0 && ins.status === "ACTIVE") adWarnings.push("⚠️ 노출 없음 — Meta 검토 필요");
                            if ((ins.frequency ?? 0) >= 4) adWarnings.push("⚠️ 광고 피로도 주의");

                            const cardBorder = playStatus.border;
                            const cardBg = playStatus.bg;

                            return (
                              <Card key={ins.id} className={`border-2 ${cardBorder} ${cardBg}`}>
                                <CardContent className="p-0">

                                  {/* ── 카드 헤더 (클릭으로 펼침) ────────── */}
                                  <button
                                    className="w-full text-left p-3 pb-2"
                                    onClick={() => setMonitoringExpandedAd(isExpanded ? null : ins.adId)}
                                  >
                                    <div className="flex items-start gap-2 flex-wrap">
                                      {/* 4단계 상태 아이콘 */}
                                      <span className="mt-0.5 shrink-0 text-lg leading-none">{playStatus.badge}</span>
                                      <div className="flex-1 min-w-0">
                                        {/* 광고주명 + 광고명 */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {ins.businessName && (
                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                              {ins.businessName}
                                            </span>
                                          )}
                                          <span className="text-sm font-semibold truncate max-w-[240px]">
                                            {ins.adTitle || ins.adName || ins.adId}
                                          </span>
                                          {/* 4단계 상태 레이블 */}
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${playStatus.color} ${playStatus.bg} border-current`}>
                                            {playStatus.label}{!hasEnoughData ? " (데이터 부족)" : ""}
                                          </span>
                                        </div>
                                        {/* 배지 줄 */}
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                          {/* 묶음 배지 */}
                                          {ins.pools.length > 0
                                            ? ins.pools.map((p) => (
                                                <span key={p.poolId} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                                  📦 {p.poolName}
                                                </span>
                                              ))
                                            : (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                                  묶음 미배정
                                                </span>
                                              )}
                                          {/* Meta 상태 */}
                                          {ins.status && (
                                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                              {ins.status}
                                            </Badge>
                                          )}
                                          {/* 날짜 */}
                                          <span className="text-[10px] text-muted-foreground">{ins.dateStart} ~ {ins.dateStop}</span>
                                        </div>
                                        {/* ── 경고 태그 (소재 개선 권고, 자동 중단 없음) ── */}
                                        {adWarnings.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1.5">
                                            {adWarnings.map((w) => (
                                              <span key={w} className="text-[10px] bg-amber-50 border border-amber-300 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                                {w}
                                              </span>
                                            ))}
                                            <span className="text-[10px] text-muted-foreground italic">— 관리자 수동 조치 필요</span>
                                          </div>
                                        )}
                                      </div>
                                      <span className="shrink-0 text-muted-foreground text-xs mt-1">{isExpanded ? "▲" : "▼"}</span>
                                    </div>

                                    {/* ── 7단계 진행 바 ─────────────────── */}
                                    <div className="mt-3 flex items-center gap-0">
                                      {CYCLE_STEPS.map((step, idx) => {
                                        const isDone = isOk ? true : step.n < currentStep;
                                        const isCurrent = !isOk && step.n === currentStep;
                                        const isPending = !isOk && step.n > currentStep;
                                        return (
                                          <React.Fragment key={step.n}>
                                            <div className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0
                                                ${isDone ? "bg-green-500 border-green-500 text-white"
                                                  : isCurrent ? (ins.healthStatus === "critical" ? "bg-red-500 border-red-500 text-white animate-pulse" : "bg-yellow-400 border-yellow-400 text-white animate-pulse")
                                                  : "bg-white border-gray-200 text-gray-300"}`}>
                                                {isDone ? "✓" : step.n}
                                              </div>
                                              <span className={`text-[9px] mt-0.5 hidden sm:block leading-tight text-center
                                                ${isDone ? "text-green-600 font-medium"
                                                  : isCurrent ? (ins.healthStatus === "critical" ? "text-red-600 font-bold" : "text-yellow-700 font-bold")
                                                  : "text-gray-300"}`}>
                                                {step.short}
                                              </span>
                                            </div>
                                            {idx < CYCLE_STEPS.length - 1 && (
                                              <div className={`h-0.5 flex-1 mx-0.5 rounded
                                                ${step.n < currentStep || isOk ? "bg-green-400" : "bg-gray-200"}`} />
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                  </button>

                                  {/* ── 현재 단계 요약 (항상 표시) ────────── */}
                                  {!isOk && (
                                    <div className={`mx-3 mb-2 px-3 py-2 rounded-lg text-xs
                                      ${ins.healthStatus === "critical" ? "bg-red-100 border border-red-200 text-red-800" : "bg-yellow-100 border border-yellow-200 text-yellow-800"}`}>
                                      <span className="font-semibold">
                                        {currentStep}단계 · {CYCLE_STEPS[currentStep - 1]?.label}
                                      </span>
                                      {ins.issues.length > 0 && (
                                        <span className="ml-2">{ins.issues[0]}</span>
                                      )}
                                    </div>
                                  )}
                                  {isOk && (
                                    <div className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs bg-green-100 border border-green-200 text-green-800">
                                      ✅ 모든 지표 정상 — 현재 최적 상태로 운영 중입니다
                                    </div>
                                  )}

                                  {/* ── 펼침: 상세 지표 + 개선 액션 ────────── */}
                                  {isExpanded && (
                                    <div className="border-t bg-white/60 px-3 pt-3 pb-3 space-y-3">

                                      {/* 지표 그리드 */}
                                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                        {[
                                          { label: "노출", value: ins.impressions.toLocaleString(),
                                            flag: ins.impressions === 0 ? "red" : "ok" },
                                          { label: "클릭", value: ins.clicks.toLocaleString(), flag: "ok" },
                                          { label: "CTR",
                                            value: ins.ctr != null ? `${ins.ctr.toFixed(2)}%` : "-",
                                            flag: ins.ctr == null ? "gray" : ins.ctr < 0.3 ? "red" : ins.ctr < 0.7 ? "yellow" : "ok" },
                                          { label: "CPC",
                                            value: ins.cpc != null ? `₩${Math.round(ins.cpc).toLocaleString()}` : "-",
                                            flag: ins.cpc == null ? "gray" : ins.cpc > 2000 ? "red" : ins.cpc > 1000 ? "yellow" : "ok" },
                                          { label: "지출", value: `₩${Math.round(ins.spend).toLocaleString()}`, flag: "ok" },
                                          { label: "도달", value: ins.reach.toLocaleString(), flag: "ok" },
                                          { label: "Freq.",
                                            value: ins.frequency != null ? ins.frequency.toFixed(1) : "-",
                                            flag: ins.frequency == null ? "gray" : ins.frequency >= 5 ? "red" : ins.frequency >= 3 ? "yellow" : "ok" },
                                          { label: "CPP",
                                            value: ins.cpp != null ? `₩${Math.round(ins.cpp).toLocaleString()}` : "-",
                                            flag: "ok" },
                                        ].map(({ label, value, flag }) => (
                                          <div key={label} className={`rounded border px-2 py-1.5 text-center
                                            ${flag === "red" ? "bg-red-50 border-red-200" : flag === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-white"}`}>
                                            <p className="text-[10px] text-muted-foreground">{label}</p>
                                            <p className={`text-xs font-bold mt-0.5
                                              ${flag === "red" ? "text-red-700" : flag === "yellow" ? "text-yellow-700" : "text-gray-800"}`}>
                                              {value}
                                            </p>
                                          </div>
                                        ))}
                                      </div>

                                      {/* 원인 분석 */}
                                      {ins.issues.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold text-gray-600">🔍 원인 분석</p>
                                          {ins.issues.map((issue, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded px-2 py-1">
                                              <span className="shrink-0 mt-0.5">⚠</span>
                                              <span>{issue}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* 개선 제안 */}
                                      {ins.tips.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold text-gray-600">💡 개선 제안</p>
                                          {ins.tips.map((tip, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-blue-800 bg-blue-50 rounded px-2 py-1">
                                              <span className="shrink-0 mt-0.5">→</span>
                                              <span>{tip}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* 시간대 최적화 팁 */}
                                      {ins.issues.some((i) => i.includes("Frequency")) && (
                                        <div className="space-y-1">
                                          <p className="text-xs font-semibold text-gray-600">🕐 시간대 최적화</p>
                                          {[
                                            "한국 SNS 최적 노출 시간: 오전 8~9시, 점심 12~1시, 저녁 7~9시",
                                            "현재 Frequency가 높으므로 게재 일정을 특정 시간대로 제한하세요",
                                            "Meta 광고관리자 → 광고세트 → 게재 일정에서 요일/시간 지정 가능",
                                          ].map((tip, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs text-purple-800 bg-purple-50 rounded px-2 py-1">
                                              <span className="shrink-0 mt-0.5">→</span>
                                              <span>{tip}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* 액션 버튼 */}
                                      <div className="flex flex-wrap gap-2 pt-1 border-t">
                                        {ins.internalAdId && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-xs h-7"
                                              onClick={() => void handleDraft(ins.internalAdId!)}
                                            >
                                              <MessageSquare className="w-3 h-3 mr-1" />
                                              제목/문구 재생성
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-xs h-7"
                                              onClick={() => void handleCard(ins.internalAdId!)}
                                            >
                                              <ImageIcon className="w-3 h-3 mr-1" />
                                              카드이미지 재생성
                                            </Button>
                                          </>
                                        )}
                                        {ins.pools.length > 0 && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7 border-blue-300 text-blue-700"
                                            onClick={() => void handleReLaunch(ins.pools[0].poolId)}
                                          >
                                            <Send className="w-3 h-3 mr-1" />
                                            Meta 재집행
                                          </Button>
                                        )}
                                        {ins.pools.length === 0 && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7 border-gray-300 text-gray-600"
                                            onClick={() => setAdCenterTab("meta")}
                                          >
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            Meta연동 탭에서 집행
                                          </Button>
                                        )}
                                        <p className="text-[10px] text-muted-foreground self-center ml-auto">
                                          수집: {new Date(ins.collectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ─ 성과 리포트 탭 ─ */}
                {adCenterTab === "performance" && (() => {
                  const pools = adPoolsData?.pools ?? [];
                  const perf = poolPerfData;
                  return (
                    <div className="space-y-4">
                      {/* 풀 선택 + 기간 필터 */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[160px]">
                              <label className="text-xs text-muted-foreground mb-1 block">광고 묶음 선택</label>
                              <select
                                className="w-full border rounded-md px-3 py-1.5 text-sm bg-white"
                                value={perfPoolId ?? ""}
                                onChange={(e) => setPerfPoolId(e.target.value || null)}
                              >
                                <option value="">-- 선택 --</option>
                                {pools.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
                              <Input type="date" value={perfSince} onChange={(e) => setPerfSince(e.target.value)} className="w-36 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">종료일</label>
                              <Input type="date" value={perfUntil} onChange={(e) => setPerfUntil(e.target.value)} className="w-36 text-sm" />
                            </div>
                            <Button size="sm" onClick={() => refetchPoolPerf()} disabled={!perfPoolId || poolPerfLoading} className="bg-blue-600 hover:bg-blue-700">
                              {poolPerfLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                              <span className="ml-1">조회</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!perfPoolId || seedLoading}
                              onClick={async () => {
                                if (!perfPoolId) return;
                                setSeedLoading(true);
                                try {
                                  const r = await fetch(`${BASE}/api/performance/seed`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ poolId: perfPoolId }),
                                  });
                                  const d = await r.json() as { success?: boolean; saved?: number; days?: number; adCount?: number; error?: string };
                                  if (!r.ok) toast({ description: d.error ?? "시딩 실패", variant: "destructive" });
                                  else {
                                    toast({ description: `샘플 데이터 ${d.saved ?? 0}건 생성 완료 (${d.adCount ?? 0}개 광고 × ${d.days ?? 30}일)` });
                                    void refetchPoolPerf();
                                    void refetchPerfRows();
                                  }
                                } catch {
                                  toast({ description: "시딩 실패", variant: "destructive" });
                                } finally {
                                  setSeedLoading(false);
                                }
                              }}
                            >
                              {seedLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                              샘플 데이터 생성
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!perfPoolId || seedLoading}
                              onClick={async () => {
                                if (!perfPoolId) return;
                                if (!confirm("이 묶음의 샘플 데이터를 모두 삭제할까요?")) return;
                                setSeedLoading(true);
                                try {
                                  const r = await fetch(`${BASE}/api/performance/seed/${perfPoolId}`, {
                                    method: "DELETE",
                                    credentials: "include",
                                  });
                                  const d = await r.json() as { success?: boolean; deleted?: number; error?: string };
                                  if (!r.ok) toast({ description: d.error ?? "삭제 실패", variant: "destructive" });
                                  else {
                                    toast({ description: `샘플 데이터 ${d.deleted ?? 0}건 삭제 완료` });
                                    void refetchPoolPerf();
                                    void refetchPerfRows();
                                  }
                                } catch {
                                  toast({ description: "삭제 실패", variant: "destructive" });
                                } finally {
                                  setSeedLoading(false);
                                }
                              }}
                            >
                              {seedLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                              샘플 데이터 초기화
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!perfPoolId}
                              onClick={() => setShowManualForm((v) => !v)}
                            >
                              <PlusCircle className="w-3 h-3 mr-1" />
                              수동 입력
                            </Button>
                            <a
                              href={perfPoolId ? `${BASE}/api/ad-pools/${perfPoolId}/performance/export?since=${perfSince}&until=${perfUntil}` : "#"}
                              download
                              onClick={(e) => { if (!perfPoolId) e.preventDefault(); }}
                              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${perfPoolId ? "border-green-600 text-green-700 hover:bg-green-50 cursor-pointer" : "border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none"}`}
                            >
                              <Download className="w-3 h-3" />
                              CSV 내보내기
                            </a>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 수동 성과 입력 폼 */}
                      {perfPoolId && showManualForm && (() => {
                        const selectedPool = pools.find((p) => p.id === perfPoolId);
                        const poolAdIds = selectedPool?.adIds ?? [];
                        const poolAds = (adsData?.ads ?? []).filter((a) => poolAdIds.includes(a.id));
                        return (
                          <Card className="border-orange-200 bg-orange-50/40">
                            <CardContent className="p-4 space-y-3">
                              <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                                <PlusCircle className="w-4 h-4" />수동 성과 입력
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">광고 선택</label>
                                  <select
                                    className="w-full border rounded-md px-3 py-1.5 text-sm bg-white"
                                    value={manualAdId}
                                    onChange={(e) => setManualAdId(e.target.value)}
                                  >
                                    <option value="">-- 광고 선택 --</option>
                                    {poolAds.map((a) => (
                                      <option key={a.id} value={a.id}>{a.title} ({a.businessName})</option>
                                    ))}
                                    {poolAds.length === 0 && poolAdIds.map((id) => (
                                      <option key={id} value={id}>{id.slice(-8)}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">날짜</label>
                                  <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="text-sm bg-white" />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">노출수</label>
                                  <Input type="number" min="0" placeholder="0" value={manualImpressions} onChange={(e) => setManualImpressions(e.target.value)} className="text-sm bg-white" />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">클릭수</label>
                                  <Input type="number" min="0" placeholder="0" value={manualClicks} onChange={(e) => setManualClicks(e.target.value)} className="text-sm bg-white" />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">지출(₩)</label>
                                  <Input type="number" min="0" placeholder="0" value={manualSpend} onChange={(e) => setManualSpend(e.target.value)} className="text-sm bg-white" />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">도달수</label>
                                  <Input type="number" min="0" placeholder="0" value={manualReach} onChange={(e) => setManualReach(e.target.value)} className="text-sm bg-white" />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setShowManualForm(false)}>취소</Button>
                                <Button
                                  size="sm"
                                  className="bg-orange-600 hover:bg-orange-700"
                                  disabled={manualLoading || !manualAdId || !manualDate}
                                  onClick={async () => {
                                    if (!manualAdId || !manualDate) return;
                                    setManualLoading(true);
                                    try {
                                      const r = await fetch(`${BASE}/api/performance/manual`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        credentials: "include",
                                        body: JSON.stringify({
                                          adId: manualAdId,
                                          poolId: perfPoolId,
                                          date: manualDate,
                                          impressions: Number(manualImpressions) || 0,
                                          clicks: Number(manualClicks) || 0,
                                          spend: Number(manualSpend) || 0,
                                          reach: Number(manualReach) || 0,
                                        }),
                                      });
                                      const d = await r.json() as { success?: boolean; error?: string };
                                      if (!r.ok) toast({ description: d.error ?? "입력 실패", variant: "destructive" });
                                      else {
                                        toast({ description: `${manualDate} 성과 데이터가 저장되었습니다` });
                                        setManualImpressions("");
                                        setManualClicks("");
                                        setManualSpend("");
                                        setManualReach("");
                                        void refetchPoolPerf();
                                        void refetchPerfRows();
                                      }
                                    } catch {
                                      toast({ description: "입력 실패", variant: "destructive" });
                                    } finally {
                                      setManualLoading(false);
                                    }
                                  }}
                                >
                                  {manualLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                                  저장
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}

                      {!perfPoolId && (
                        <div className="py-16 text-center text-muted-foreground text-sm">
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          광고 묶음을 선택하면 성과 데이터를 확인할 수 있습니다.
                        </div>
                      )}

                      {perfPoolId && !poolPerfLoading && perf && (
                        <>
                          {/* 요약 카드 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { label: "총 노출수", value: perf.summary.totalImpressions.toLocaleString(), sub: "회", cls: "text-blue-700" },
                              { label: "총 클릭수", value: perf.summary.totalClicks.toLocaleString(), sub: "회", cls: "text-green-700" },
                              { label: "클릭률(CTR)", value: `${perf.summary.ctr}%`, sub: "", cls: "text-purple-700" },
                              { label: "예산 소진율", value: `${perf.summary.budgetUsedPct}%`, sub: `₩${perf.summary.totalSpend.toLocaleString()} 사용`, cls: perf.summary.budgetUsedPct >= 90 ? "text-red-600" : "text-orange-600" },
                            ].map((c) => (
                              <Card key={c.label}>
                                <CardContent className="p-4">
                                  <p className="text-xs text-muted-foreground">{c.label}</p>
                                  <p className={`text-2xl font-bold mt-1 ${c.cls}`}>{c.value}</p>
                                  {c.sub && <p className="text-[10px] text-muted-foreground">{c.sub}</p>}
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          {/* 일별 노출·클릭 막대그래프 */}
                          {perf.dailyChart.length > 0 ? (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-sm font-semibold mb-3">일별 노출 / 클릭 추이</p>
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={perf.dailyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(), name === "impressions" ? "노출" : "클릭"]} labelFormatter={(l: string) => `날짜: ${l}`} />
                                    <Legend formatter={(v: string) => v === "impressions" ? "노출수" : "클릭수"} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="impressions" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                    <Bar dataKey="clicks" fill="#10b981" radius={[2, 2, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card>
                              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                                해당 기간에 성과 데이터가 없습니다.<br />
                                <span className="text-xs">Meta 연동 후 "성과 수집"을 실행하거나, 수동으로 데이터를 입력하세요.</span>
                              </CardContent>
                            </Card>
                          )}

                          {/* CTR 선그래프 */}
                          {perf.dailyChart.length > 1 && (
                            <Card>
                              <CardContent className="p-4">
                                <p className="text-sm font-semibold mb-3">일별 CTR(클릭률) 추이</p>
                                <ResponsiveContainer width="100%" height={160}>
                                  <LineChart data={perf.dailyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                                    <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, "auto"]} />
                                    <Tooltip formatter={(v: number) => [`${v}%`, "CTR"]} labelFormatter={(l: string) => `날짜: ${l}`} />
                                    <Line type="monotone" dataKey="ctr" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}

                      {/* 광고별 성과 테이블 */}
                      {perfPoolId && !poolPerfLoading && perf && perf.adBreakdown && perf.adBreakdown.length > 0 && (
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm font-semibold mb-3">광고별 성과 비교</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">광고 제목</th>
                                    <th className="text-right py-2 px-2 font-medium">노출수</th>
                                    <th className="text-right py-2 px-2 font-medium">클릭수</th>
                                    <th className="text-right py-2 px-2 font-medium">CTR</th>
                                    <th className="text-right py-2 pl-2 font-medium">지출</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {perf.adBreakdown.map((ad: { adId: string; title: string; businessName: string; impressions: number; clicks: number; ctr: number; spend: number }) => (
                                    <tr key={ad.adId} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="py-2 pr-3">
                                        <p className="font-medium truncate max-w-[180px]">{ad.title}</p>
                                        <p className="text-muted-foreground">{ad.businessName}</p>
                                      </td>
                                      <td className="text-right py-2 px-2 font-mono">{ad.impressions.toLocaleString()}</td>
                                      <td className="text-right py-2 px-2 font-mono">{ad.clicks.toLocaleString()}</td>
                                      <td className="text-right py-2 px-2 font-mono">{ad.ctr}%</td>
                                      <td className="text-right py-2 pl-2 font-mono">₩{ad.spend.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* 입력 내역 테이블 */}
                      {perfPoolId && perfRowsData && perfRowsData.rows.length > 0 && (
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4 text-muted-foreground" />
                              입력 내역 <span className="text-xs font-normal text-muted-foreground ml-1">({perfRowsData.total}건)</span>
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b text-muted-foreground">
                                    <th className="text-left py-2 pr-3 font-medium">날짜</th>
                                    <th className="text-left py-2 pr-3 font-medium">광고</th>
                                    <th className="text-right py-2 px-2 font-medium">노출</th>
                                    <th className="text-right py-2 px-2 font-medium">클릭</th>
                                    <th className="text-right py-2 px-2 font-medium">지출</th>
                                    <th className="text-center py-2 px-2 font-medium">출처</th>
                                    <th className="py-2 pl-2 font-medium"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {perfRowsData.rows.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                                      <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{row.date}</td>
                                      <td className="py-1.5 pr-3">
                                        <p className="font-medium truncate max-w-[140px]">{row.adTitle}</p>
                                        {row.businessName && <p className="text-muted-foreground truncate max-w-[140px]">{row.businessName}</p>}
                                      </td>
                                      <td className="text-right py-1.5 px-2 font-mono">{row.impressions.toLocaleString()}</td>
                                      <td className="text-right py-1.5 px-2 font-mono">{row.clicks.toLocaleString()}</td>
                                      <td className="text-right py-1.5 px-2 font-mono">₩{row.spend.toLocaleString()}</td>
                                      <td className="text-center py-1.5 px-2">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          row.source === "manual" ? "bg-orange-100 text-orange-700" :
                                          row.source === "sample" ? "bg-gray-100 text-gray-600" :
                                          "bg-blue-100 text-blue-700"
                                        }`}>
                                          {row.source === "manual" ? "수동" : row.source === "sample" ? "샘플" : "Meta"}
                                        </span>
                                      </td>
                                      <td className="py-1.5 pl-2">
                                        <button
                                          className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                                          title="삭제"
                                          onClick={async () => {
                                            if (!confirm(`${row.date} 행을 삭제할까요?`)) return;
                                            try {
                                              const r = await fetch(`${BASE}/api/performance/${row.id}`, {
                                                method: "DELETE",
                                                credentials: "include",
                                              });
                                              const d = await r.json() as { success?: boolean; error?: string };
                                              if (!r.ok) toast({ description: d.error ?? "삭제 실패", variant: "destructive" });
                                              else {
                                                toast({ description: "삭제되었습니다" });
                                                void refetchPerfRows();
                                                void refetchPoolPerf();
                                              }
                                            } catch {
                                              toast({ description: "삭제 실패", variant: "destructive" });
                                            }
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {perfPoolId && perfRowsData && perfRowsData.rows.length === 0 && !poolPerfLoading && (
                        <Card>
                          <CardContent className="p-6 text-center text-muted-foreground text-xs">
                            <BookOpen className="w-5 h-5 mx-auto mb-1.5 text-gray-300" />
                            입력된 성과 내역이 없습니다.
                          </CardContent>
                        </Card>
                      )}

                      {perfPoolId && poolPerfLoading && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />로딩 중...
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ─ 정산 관리 탭 ─ */}
                {adCenterTab === "billing" && (() => {
                  const items = billingSummaryData?.summaries ?? [];
                  const expired = items.filter((i) => i.isExpired);
                  const active = items.filter((i) => i.status === "active" && !i.isExpired);
                  const others = items.filter((i) => i.status !== "active");

                  const PRODUCT_TYPE_OPTS = [
                    { value: "ad_run",       label: "광고집행형" },
                    { value: "image_create", label: "이미지제작형" },
                    { value: "coverage",     label: "취재포함형" },
                    { value: "etc",          label: "기타" },
                  ];
                  const ptLabel = (v: string) => PRODUCT_TYPE_OPTS.find((o) => o.value === v)?.label ?? v;

                  async function saveProduct(e: React.FormEvent) {
                    e.preventDefault();
                    if (!productForm.name.trim()) { toast({ description: "상품명을 입력해주세요.", variant: "destructive" }); return; }
                    const amt = Number(productForm.amount);
                    if (!amt || amt <= 0) { toast({ description: "가격을 올바르게 입력해주세요.", variant: "destructive" }); return; }
                    setProductFormLoading(true);
                    try {
                      const body = {
                        name: productForm.name.trim(),
                        description: productForm.description.trim(),
                        amount: amt,
                        adDurationDays: productForm.adDurationDays ? Number(productForm.adDurationDays) : null,
                        productType: productForm.productType,
                        isActive: productForm.isActive,
                        sortOrder: Number(productForm.sortOrder) || 0,
                        marginRate: Number(productForm.marginRate) / 100,
                      };
                      const url = editingProduct
                        ? `${BASE}/api/admin/ad-products/${editingProduct.id}`
                        : `${BASE}/api/admin/ad-products`;
                      const r = await fetch(url, {
                        method: editingProduct ? "PATCH" : "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(body),
                      });
                      if (!r.ok) {
                        const d = await r.json() as { error?: string };
                        toast({ description: d.error ?? "저장 실패", variant: "destructive" });
                        return;
                      }
                      toast({ description: editingProduct ? "상품이 수정되었습니다." : "상품이 추가되었습니다." });
                      setShowProductForm(false);
                      setEditingProduct(null);
                      setProductForm({ name: "", description: "", amount: "", adDurationDays: "", productType: "ad_run", isActive: true, sortOrder: "0", marginRate: "30" });
                      void refetchAdminProducts();
                    } finally {
                      setProductFormLoading(false);
                    }
                  }

                  async function toggleActive(p: AdProduct) {
                    await fetch(`${BASE}/api/admin/ad-products/${p.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ isActive: !p.isActive }),
                    });
                    void refetchAdminProducts();
                  }

                  async function deleteProduct(p: AdProduct) {
                    if (!window.confirm(`"${p.name}" 상품을 삭제하시겠습니까?`)) return;
                    const r = await fetch(`${BASE}/api/admin/ad-products/${p.id}`, { method: "DELETE", credentials: "include" });
                    if (r.ok) { toast({ description: "삭제되었습니다." }); void refetchAdminProducts(); }
                    else toast({ description: "삭제 실패", variant: "destructive" });
                  }

                  function startEdit(p: AdProduct) {
                    setEditingProduct(p);
                    setProductForm({
                      name: p.name,
                      description: p.description,
                      amount: String(p.amount),
                      adDurationDays: p.adDurationDays != null ? String(p.adDurationDays) : "",
                      productType: p.productType,
                      isActive: p.isActive,
                      sortOrder: String(p.sortOrder),
                      marginRate: String(Math.round(p.marginRate * 100)),
                    });
                    setShowProductForm(true);
                  }

                  const productFormEl = (showProductForm || editingProduct) ? (
                    <Card className="border-blue-200 bg-blue-50/40">
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-blue-800 mb-3">{editingProduct ? "상품 수정" : "새 상품 추가"}</p>
                        <form onSubmit={(e) => void saveProduct(e)} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[11px] text-gray-600 font-medium">상품명 *</label>
                              <Input value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 3일 광고" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[11px] text-gray-600 font-medium">상품 설명</label>
                              <Input value={productForm.description} onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} placeholder="간단한 설명" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-600 font-medium">판매가격 (원) *</label>
                              <Input type="number" min="0" value={productForm.amount} onChange={(e) => setProductForm((f) => ({ ...f, amount: e.target.value }))} placeholder="40000" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-600 font-medium">광고 기간 (일)</label>
                              <Input type="number" min="0" value={productForm.adDurationDays} onChange={(e) => setProductForm((f) => ({ ...f, adDurationDays: e.target.value }))} placeholder="비우면 해당없음" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-600 font-medium">상품 유형</label>
                              <select value={productForm.productType} onChange={(e) => setProductForm((f) => ({ ...f, productType: e.target.value }))} className="mt-0.5 h-8 text-sm w-full border rounded-md px-2 bg-white">
                                {PRODUCT_TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-600 font-medium">마진율 (%)</label>
                              <Input type="number" min="0" max="100" value={productForm.marginRate} onChange={(e) => setProductForm((f) => ({ ...f, marginRate: e.target.value }))} placeholder="30" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] text-gray-600 font-medium">노출 순서</label>
                              <Input type="number" value={productForm.sortOrder} onChange={(e) => setProductForm((f) => ({ ...f, sortOrder: e.target.value }))} placeholder="0" className="mt-0.5 h-8 text-sm" />
                            </div>
                            <div className="flex items-center gap-2 pt-3">
                              <input type="checkbox" id="isActiveCheck" checked={productForm.isActive} onChange={(e) => setProductForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                              <label htmlFor="isActiveCheck" className="text-[11px] text-gray-600 font-medium select-none cursor-pointer">활성화 (결제 화면에 표시)</label>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={productFormLoading}>
                              {productFormLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                              {editingProduct ? "수정 완료" : "추가"}
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setShowProductForm(false); setEditingProduct(null); setProductForm({ name: "", description: "", amount: "", adDurationDays: "", productType: "ad_run", isActive: true, sortOrder: "0", marginRate: "30" }); }}>
                              취소
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  ) : null;

                  async function reorderProducts(products: AdProduct[], fromIdx: number, dir: -1 | 1) {
                    const toIdx = fromIdx + dir;
                    if (toIdx < 0 || toIdx >= products.length) return;
                    const order = products.map((p, i) => {
                      if (i === fromIdx) return { id: p.id, sortOrder: toIdx };
                      if (i === toIdx) return { id: p.id, sortOrder: fromIdx };
                      return { id: p.id, sortOrder: i };
                    });
                    const r = await fetch(`${BASE}/api/admin/ad-products/reorder`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ order }),
                    });
                    if (r.ok) void refetchAdminProducts();
                    else toast({ title: "순서 저장 실패", variant: "destructive" });
                  }

                  async function loadCampaignDetail(campaignId: string) {
                    if (campaignDetail[campaignId]) {
                      setExpandedCampaign((prev) => (prev === campaignId ? null : campaignId));
                      return;
                    }
                    setCampaignDetailLoading(campaignId);
                    setExpandedCampaign(campaignId);
                    try {
                      const r = await fetch(`${BASE}/api/meta/spend/campaign/${campaignId}`, { credentials: "include" });
                      if (r.ok) {
                        const d = await r.json() as MetaCampaignDetail;
                        setCampaignDetail((prev) => ({ ...prev, [campaignId]: d }));
                      }
                    } finally {
                      setCampaignDetailLoading(null);
                    }
                  }

                  async function saveBudgetLimit(campaignId: string, campaignName: string) {
                    const val = Number(editingBudgetValue);
                    if (isNaN(val) || val < 0) { toast({ description: "올바른 금액을 입력하세요.", variant: "destructive" }); return; }
                    setBudgetSaveLoading(true);
                    try {
                      const r = await fetch(`${BASE}/api/meta/budget-limits`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ campaignId, campaignName, dailyLimit: val }),
                      });
                      if (r.ok) { toast({ description: "예산 한도가 저장되었습니다." }); setEditingBudgetId(null); void refetchMetaSpend(); }
                      else toast({ description: "저장 실패", variant: "destructive" });
                    } finally { setBudgetSaveLoading(false); }
                  }

                  async function deleteBudgetLimit(campaignId: string) {
                    const r = await fetch(`${BASE}/api/meta/budget-limits/${campaignId}`, { method: "DELETE", credentials: "include" });
                    if (r.ok) { toast({ description: "한도가 삭제되었습니다." }); void refetchMetaSpend(); }
                    else toast({ description: "삭제 실패", variant: "destructive" });
                  }

                  async function pauseEntity(type: "campaign" | "adset", id: string, currentStatus: string) {
                    const nextStatus = currentStatus === "PAUSED" ? "resume" : "pause";
                    const endpoint = type === "campaign" ? `campaigns` : `adsets`;
                    setPauseLoading(id);
                    try {
                      const r = await fetch(`${BASE}/api/meta/${endpoint}/${id}/${nextStatus}`, { method: "POST", credentials: "include" });
                      if (r.ok) {
                        toast({ description: nextStatus === "pause" ? "일시정지 처리되었습니다." : "재개되었습니다." });
                        void refetchMetaSpend();
                        setCampaignDetail({});
                      } else {
                        const d = await r.json() as { error?: string };
                        toast({ description: d.error ?? "처리 실패", variant: "destructive" });
                      }
                    } finally { setPauseLoading(null); }
                  }

                  const campaigns = metaSpendData?.campaigns ?? [];
                  const account = metaSpendData?.account ?? null;
                  const warnings = campaigns.filter((c) => c.usagePct != null && c.usagePct >= 80);

                  return (
                    <div className="space-y-4">

                      {/* ── Meta 실시간 광고비 모니터링 ──────────────────────────── */}
                      <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                          <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                            Meta 실시간 광고비 모니터링
                          </p>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-blue-200" onClick={() => void refetchMetaSpend()} disabled={metaSpendLoading}>
                            <RefreshCw className={`w-3 h-3 mr-1 ${metaSpendLoading ? "animate-spin" : ""}`} />
                            {metaSpendData?.fetchedAt ? new Date(metaSpendData.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "새로고침"}
                          </Button>
                        </div>

                        {metaSpendLoading && (
                          <div className="py-8 text-center text-sm text-muted-foreground">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />Meta API에서 데이터 불러오는 중…
                          </div>
                        )}

                        {!metaSpendLoading && metaSpendData && (
                          <div className="p-4 space-y-4">

                            {/* 경고 배너 */}
                            {warnings.length > 0 && (
                              <div className="space-y-1.5">
                                {warnings.map((c) => (
                                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                                    (c.usagePct ?? 0) >= 100 ? "bg-red-50 text-red-700 border border-red-200" :
                                    (c.usagePct ?? 0) >= 95 ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                    "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                  }`}>
                                    <span className="text-base">{(c.usagePct ?? 0) >= 100 ? "🚨" : (c.usagePct ?? 0) >= 95 ? "⚠️" : "⚡"}</span>
                                    <span>
                                      <strong>{c.name}</strong> — 내부 한도 대비 <strong>{c.usagePct}%</strong> 소진
                                      {(c.usagePct ?? 0) >= 100 && " (한도 초과! 즉시 검토 필요)"}
                                      {(c.usagePct ?? 0) >= 95 && (c.usagePct ?? 0) < 100 && " (95% 도달 — 주의)"}
                                      {(c.usagePct ?? 0) >= 80 && (c.usagePct ?? 0) < 95 && " (80% 도달)"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 계정 요약 카드 */}
                            {account && (
                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">오늘 지출</p>
                                  <p className="text-lg font-bold text-blue-700">₩{Math.round(account.todaySpend).toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">누적 지출 (이번달)</p>
                                  <p className="text-lg font-bold text-gray-800">
                                    {account.amountSpent != null ? `₩${Math.round(account.amountSpent).toLocaleString()}` : "—"}
                                  </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">지출 한도 (계정)</p>
                                  <p className="text-lg font-bold text-gray-800">
                                    {account.spendCap != null ? `₩${Math.round(account.spendCap).toLocaleString()}` : "없음"}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* 캠페인 테이블 */}
                            {campaigns.length === 0 ? (
                              <p className="text-xs text-center text-muted-foreground py-4">캠페인이 없거나 Meta API에서 데이터를 가져오지 못했습니다.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50 border-b">
                                    <tr>
                                      {["", "캠페인명", "오늘 지출", "일 예산 (Meta)", "내부 한도", "소진율", "상태", "제어"].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {campaigns.map((c) => {
                                      const pct = c.usagePct;
                                      const isExpanded = expandedCampaign === c.id;
                                      const detail = campaignDetail[c.id];
                                      return (
                                        <>
                                          <tr key={c.id} className={`border-b hover:bg-gray-50 ${isExpanded ? "bg-blue-50/30" : ""}`}>
                                            <td className="px-2 py-2">
                                              <button
                                                onClick={() => void loadCampaignDetail(c.id)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                title={isExpanded ? "접기" : "광고세트/광고 보기"}
                                              >
                                                {campaignDetailLoading === c.id ? (
                                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                  <span className="text-xs">{isExpanded ? "▲" : "▶"}</span>
                                                )}
                                              </button>
                                            </td>
                                            <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{c.name}</td>
                                            <td className="px-3 py-2 font-mono font-semibold text-blue-700 whitespace-nowrap">
                                              ₩{Math.round(c.todaySpend).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                              {c.dailyBudget != null ? `₩${Math.round(c.dailyBudget).toLocaleString()}` : "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              {editingBudgetId === c.id ? (
                                                <div className="flex items-center gap-1">
                                                  <input
                                                    type="number"
                                                    value={editingBudgetValue}
                                                    onChange={(e) => setEditingBudgetValue(e.target.value)}
                                                    className="w-24 h-6 border rounded px-1.5 text-xs"
                                                    placeholder="0"
                                                    autoFocus
                                                    onKeyDown={(e) => { if (e.key === "Enter") void saveBudgetLimit(c.id, c.name); if (e.key === "Escape") setEditingBudgetId(null); }}
                                                  />
                                                  <button onClick={() => void saveBudgetLimit(c.id, c.name)} disabled={budgetSaveLoading} className="text-blue-600 hover:text-blue-800 text-[10px] font-medium">저장</button>
                                                  <button onClick={() => setEditingBudgetId(null)} className="text-gray-400 hover:text-gray-600 text-[10px]">취소</button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1">
                                                  <span className="text-gray-700">
                                                    {c.internalDailyLimit != null ? `₩${c.internalDailyLimit.toLocaleString()}` : "미설정"}
                                                  </span>
                                                  <button
                                                    onClick={() => { setEditingBudgetId(c.id); setEditingBudgetValue(c.internalDailyLimit != null ? String(c.internalDailyLimit) : ""); }}
                                                    className="text-blue-400 hover:text-blue-700 text-[10px] underline"
                                                  >수정</button>
                                                  {c.internalDailyLimit != null && (
                                                    <button onClick={() => void deleteBudgetLimit(c.id)} className="text-red-300 hover:text-red-500 text-[10px]">✕</button>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              {pct != null ? (
                                                <div className="flex items-center gap-2">
                                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                      className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 95 ? "bg-orange-500" : pct >= 80 ? "bg-yellow-400" : "bg-green-400"}`}
                                                      style={{ width: `${Math.min(100, pct)}%` }}
                                                    />
                                                  </div>
                                                  <span className={`font-mono font-semibold ${pct >= 100 ? "text-red-600" : pct >= 95 ? "text-orange-600" : pct >= 80 ? "text-yellow-600" : "text-green-600"}`}>
                                                    {pct}%
                                                  </span>
                                                </div>
                                              ) : <span className="text-gray-400 text-[10px]">한도 미설정</span>}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : c.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                                                {c.status}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              <button
                                                onClick={() => void pauseEntity("campaign", c.id, c.status)}
                                                disabled={pauseLoading === c.id}
                                                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                                  c.status === "PAUSED"
                                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                    : "bg-red-100 text-red-700 hover:bg-red-200"
                                                }`}
                                              >
                                                {pauseLoading === c.id ? <RefreshCw className="w-2.5 h-2.5 animate-spin inline" /> : c.status === "PAUSED" ? "재개" : "정지"}
                                              </button>
                                            </td>
                                          </tr>

                                          {/* 확장: 광고세트 목록 */}
                                          {isExpanded && detail && (
                                            <tr key={`${c.id}-detail`}>
                                              <td colSpan={8} className="bg-blue-50/20 border-b px-6 py-3">
                                                <div className="space-y-3">
                                                  {detail.adsets.length > 0 && (
                                                    <div>
                                                      <p className="text-[10px] font-semibold text-blue-700 mb-1.5">📦 광고세트</p>
                                                      <table className="w-full text-[11px]">
                                                        <thead>
                                                          <tr className="text-gray-500">
                                                            <th className="text-left font-medium pb-1">이름</th>
                                                            <th className="text-right font-medium pb-1">오늘 지출</th>
                                                            <th className="text-right font-medium pb-1">일 예산</th>
                                                            <th className="text-center font-medium pb-1">상태</th>
                                                            <th className="text-center font-medium pb-1">제어</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {detail.adsets.map((a) => (
                                                            <tr key={a.id} className="border-t border-blue-100">
                                                              <td className="py-1 text-gray-700 max-w-[200px] truncate">{a.name}</td>
                                                              <td className="py-1 text-right font-mono text-blue-600">₩{Math.round(a.todaySpend).toLocaleString()}</td>
                                                              <td className="py-1 text-right text-gray-500">{a.dailyBudget != null ? `₩${Math.round(a.dailyBudget).toLocaleString()}` : "—"}</td>
                                                              <td className="py-1 text-center">
                                                                <span className={`px-1 py-0.5 rounded text-[10px] ${a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{a.status}</span>
                                                              </td>
                                                              <td className="py-1 text-center">
                                                                <button
                                                                  onClick={() => void pauseEntity("adset", a.id, a.status)}
                                                                  disabled={pauseLoading === a.id}
                                                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === "PAUSED" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                                                                >
                                                                  {pauseLoading === a.id ? <RefreshCw className="w-2 h-2 animate-spin inline" /> : a.status === "PAUSED" ? "재개" : "정지"}
                                                                </button>
                                                              </td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  )}
                                                  {detail.ads.length > 0 && (
                                                    <div>
                                                      <p className="text-[10px] font-semibold text-purple-700 mb-1.5">🎯 광고</p>
                                                      <table className="w-full text-[11px]">
                                                        <thead>
                                                          <tr className="text-gray-500">
                                                            <th className="text-left font-medium pb-1">이름</th>
                                                            <th className="text-right font-medium pb-1">오늘 지출</th>
                                                            <th className="text-right font-medium pb-1">노출</th>
                                                            <th className="text-right font-medium pb-1">클릭</th>
                                                            <th className="text-center font-medium pb-1">상태</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {detail.ads.map((a) => (
                                                            <tr key={a.id} className="border-t border-purple-100">
                                                              <td className="py-1 text-gray-700 max-w-[200px] truncate">{a.name}</td>
                                                              <td className="py-1 text-right font-mono text-blue-600">₩{Math.round(a.todaySpend).toLocaleString()}</td>
                                                              <td className="py-1 text-right text-gray-500">{a.impressions.toLocaleString()}</td>
                                                              <td className="py-1 text-right text-gray-500">{a.clicks.toLocaleString()}</td>
                                                              <td className="py-1 text-center">
                                                                <span className={`px-1 py-0.5 rounded text-[10px] ${a.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{a.status}</span>
                                                              </td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  )}
                                                  {detail.adsets.length === 0 && detail.ads.length === 0 && (
                                                    <p className="text-xs text-gray-400">이 캠페인에 광고세트/광고가 없습니다.</p>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {!metaSpendLoading && !metaSpendData && (
                          <div className="py-6 text-center text-xs text-muted-foreground">Meta API 데이터를 불러오지 못했습니다.</div>
                        )}
                      </div>

                      {/* ── 광고 상품 관리 ──────────────────────────────────────── */}
                      <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            <CircleDollarSign className="w-4 h-4 text-blue-600" />광고 상품 관리
                          </p>
                          {!showProductForm && !editingProduct && (
                            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowProductForm(true)}>
                              + 상품 추가
                            </Button>
                          )}
                        </div>
                        <div className="p-4 space-y-3">
                          {productFormEl}
                          {adminProductsLoading && <p className="text-xs text-muted-foreground py-4 text-center"><RefreshCw className="w-3 h-3 animate-spin inline mr-1" />로딩 중...</p>}
                          {!adminProductsLoading && (adminProductsData?.products ?? []).length === 0 && !showProductForm && (
                            <p className="text-xs text-muted-foreground py-6 text-center">등록된 광고 상품이 없습니다. 상품을 추가해주세요.</p>
                          )}
                          {!adminProductsLoading && (adminProductsData?.products ?? []).length > 0 && (
                            <div className="overflow-x-auto rounded-lg border">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b">
                                  <tr>
                                    {["↕", "상품명", "유형", "가격", "기간", "마진율", "상태", ""].map((h) => (
                                      <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(adminProductsData?.products ?? []).map((p, idx, arr) => (
                                    <tr key={p.id} className={`border-b ${!p.isActive ? "opacity-50" : ""}`}>
                                      <td className="px-2 py-2">
                                        <div className="flex flex-col gap-0.5">
                                          <button
                                            disabled={idx === 0}
                                            onClick={() => void reorderProducts(arr, idx, -1)}
                                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none px-1"
                                          >▲</button>
                                          <button
                                            disabled={idx === arr.length - 1}
                                            onClick={() => void reorderProducts(arr, idx, 1)}
                                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none px-1"
                                          >▼</button>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-gray-800">{p.name}</div>
                                        {p.description && <div className="text-[10px] text-gray-400 mt-0.5">{p.description}</div>}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">{ptLabel(p.productType)}</span>
                                      </td>
                                      <td className="px-3 py-2 font-bold text-gray-800 whitespace-nowrap">₩{p.amount.toLocaleString()}</td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{p.adDurationDays != null ? `${p.adDurationDays}일` : "—"}</td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{Math.round(p.marginRate * 100)}%</td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <button onClick={() => void toggleActive(p)} className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer border ${p.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                                          {p.isActive ? "활성" : "비활성"}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex gap-1">
                                          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => startEdit(p)}>수정</Button>
                                          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 hover:border-red-300" onClick={() => void deleteProduct(p)}>삭제</Button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 기간 만료 자동 처리 버튼 */}
                      {expired.length > 0 && (
                        <Card className="border-red-200 bg-red-50">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />기간 만료 묶음 {expired.length}개
                              </p>
                              <p className="text-xs text-red-600 mt-0.5">종료일이 지난 운영중 묶음이 있습니다. 자동 종료 처리하세요.</p>
                            </div>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                              disabled={billingExpireLoading}
                              onClick={async () => {
                                setBillingExpireLoading(true);
                                try {
                                  const r = await fetch(`${BASE}/api/billing/expire-pools`, { method: "POST", credentials: "include" });
                                  const d = await r.json() as { success?: boolean; expired?: number; error?: string };
                                  if (!r.ok) toast({ description: d.error ?? "처리 실패", variant: "destructive" });
                                  else { toast({ description: `${d.expired ?? 0}개 묶음을 종료 처리했습니다` }); refetchBilling(); }
                                } catch {
                                  toast({ description: "처리 실패", variant: "destructive" });
                                } finally {
                                  setBillingExpireLoading(false);
                                }
                              }}
                            >
                              {billingExpireLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                              일괄 종료 처리
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      {/* 요약 통계 */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "운영중 묶음", value: active.length, cls: "text-green-700" },
                          { label: "만료 처리 필요", value: expired.length, cls: expired.length > 0 ? "text-red-600" : "text-gray-400" },
                          { label: "총 예산 (운영중)", value: `₩${active.reduce((s, i) => s + i.totalBudget, 0).toLocaleString()}`, cls: "text-blue-700" },
                        ].map((c) => (
                          <Card key={c.label}>
                            <CardContent className="p-3">
                              <p className="text-[11px] text-muted-foreground">{c.label}</p>
                              <p className={`text-lg font-bold mt-0.5 ${c.cls}`}>{c.value}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* 운영중 묶음 예산 현황 */}
                      {active.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">운영중 예산 집행 현황</p>
                          {active.map((item) => (
                            <Card key={item.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <span className="font-medium text-sm">{item.name}</span>
                                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${item.metaSynced ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                                      {item.metaSynced ? "Meta연동" : "미연동"}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground shrink-0">{item.startDate} ~ {item.endDate}</span>
                                </div>
                                <div className="space-y-1.5">
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-0.5">
                                      <span className="text-muted-foreground">예산 집행</span>
                                      <span className={item.spendPct >= 90 ? "text-red-600 font-semibold" : "text-gray-700"}>
                                        ₩{item.totalSpend.toLocaleString()} / ₩{item.totalBudget.toLocaleString()} ({item.spendPct}%)
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${item.spendPct >= 90 ? "bg-red-500" : item.spendPct >= 70 ? "bg-yellow-500" : "bg-blue-500"}`}
                                        style={{ width: `${Math.min(100, item.spendPct)}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[11px] mb-0.5">
                                      <span className="text-muted-foreground">기간 경과</span>
                                      <span className="text-gray-700">{item.elapsedPct}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gray-400"
                                        style={{ width: `${Math.min(100, item.elapsedPct)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2">광고 {item.adCount}개 포함</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* 기타 묶음 목록 */}
                      {others.length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-gray-700 select-none">
                            종료/초안 묶음 {others.length}개 보기 ▾
                          </summary>
                          <div className="mt-2 space-y-2">
                            {others.map((item) => (
                              <Card key={item.id} className="opacity-60">
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div>
                                    <span className="text-sm font-medium">{item.name}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">{item.startDate} ~ {item.endDate}</span>
                                  </div>
                                  <div className="text-right text-xs text-muted-foreground">
                                    <div>₩{item.totalSpend.toLocaleString()} 집행</div>
                                    <div>/ ₩{item.totalBudget.toLocaleString()}</div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </details>
                      )}

                      {billingLoading && (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />로딩 중...
                        </div>
                      )}

                      {!billingLoading && items.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                          <CircleDollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          등록된 광고 묶음이 없습니다.
                        </div>
                      )}

                      {/* ── 계좌이체 입금확인대기 ─────────────────────────────── */}
                      {(() => {
                        const pending = (paymentOrdersData?.orders ?? []).filter(
                          (o) => o.status === "bank_transfer_requested",
                        );
                        if (pending.length === 0) return null;
                        return (
                          <div className="mt-6 border-t pt-5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pending.length}</span>
                                입금확인대기
                              </p>
                              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => void refetchPaymentOrders()}>
                                <RefreshCw className="w-3 h-3 mr-1" />새로고침
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {pending.map((o) => (
                                <div key={o.id} className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm text-gray-900">{o.productNameSnapshot ?? o.plan ?? "광고 상품"}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{o.customerName} · {o.customerEmail}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">주문번호: {o.orderId}</p>
                                      {o.depositName && (
                                        <p className="text-xs font-bold text-red-600 mt-1">
                                          입금자명: <span className="tracking-wider">{o.depositName}</span>
                                        </p>
                                      )}
                                      <p className="text-[10px] text-gray-400 mt-0.5">
                                        신청일: {new Date(o.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                                      </p>
                                    </div>
                                    <p className="font-bold text-lg text-gray-900 whitespace-nowrap shrink-0">
                                      ₩{o.amount.toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleBankConfirm(o.orderId)}
                                      disabled={bankConfirmLoading === o.orderId || bankRejectLoading === o.orderId}
                                      className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                                    >
                                      {bankConfirmLoading === o.orderId ? "처리중..." : "✅ 입금확인 완료"}
                                    </button>
                                    <button
                                      onClick={() => handleBankReject(o.orderId)}
                                      disabled={bankConfirmLoading === o.orderId || bankRejectLoading === o.orderId}
                                      className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium disabled:opacity-50 transition-colors"
                                    >
                                      {bankRejectLoading === o.orderId ? "처리중..." : "거절"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── 결제 내역 (정산 기준) ────────────────────────────── */}
                      <div className="mt-6 border-t pt-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            <CircleDollarSign className="w-4 h-4 text-blue-600" />결제 내역
                          </p>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => void refetchPaymentOrders()}>
                            <RefreshCw className="w-3 h-3 mr-1" />새로고침
                          </Button>
                        </div>
                        {paymentOrdersLoading && (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-400" />로딩 중...
                          </div>
                        )}
                        {!paymentOrdersLoading && (paymentOrdersData?.orders ?? []).length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">결제 내역이 없습니다.</p>
                        )}
                        {!paymentOrdersLoading && (paymentOrdersData?.orders ?? []).length > 0 && (
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  {["상품명", "결제금액", "마진율", "운영마진", "광고집행 기준액", "구매자", "수단", "상태", "결제일"].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(paymentOrdersData?.orders ?? []).map((o) => {
                                  const rate = o.marginRateSnapshot ?? 0;
                                  const price = o.productPriceSnapshot ?? o.amount;
                                  const margin = Math.round(price * rate);
                                  const adExec = price - margin;
                                  return (
                                    <tr key={o.id} className="border-b hover:bg-gray-50">
                                      <td className="px-3 py-2">
                                        <div className="font-medium text-gray-800">{o.productNameSnapshot ?? o.plan ?? "—"}</div>
                                        {o.adDurationDaysSnapshot && <div className="text-[10px] text-gray-400">{o.adDurationDaysSnapshot}일</div>}
                                      </td>
                                      <td className="px-3 py-2 font-bold text-gray-800 whitespace-nowrap">₩{o.amount.toLocaleString()}</td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{Math.round(rate * 100)}%</td>
                                      <td className="px-3 py-2 whitespace-nowrap text-orange-600 font-medium">₩{margin.toLocaleString()}</td>
                                      <td className="px-3 py-2 whitespace-nowrap text-blue-700 font-medium">₩{adExec.toLocaleString()}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="text-gray-700">{o.customerName}</div>
                                        <div className="text-[10px] text-gray-400">{o.customerEmail}</div>
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{o.method ?? "—"}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          o.status === "paid"                       ? "bg-green-50 text-green-700" :
                                          o.status === "failed"                     ? "bg-red-50 text-red-600" :
                                          o.status === "refunded"                   ? "bg-gray-100 text-gray-500" :
                                          o.status === "bank_transfer_requested"    ? "bg-amber-50 text-amber-700" :
                                          o.status === "bank_transfer_rejected"     ? "bg-red-50 text-red-500" :
                                          "bg-yellow-50 text-yellow-700"
                                        }`}>{
                                          o.status === "paid"                    ? "완료" :
                                          o.status === "failed"                  ? "실패" :
                                          o.status === "refunded"                ? "환불" :
                                          o.status === "bank_transfer_requested" ? "입금대기" :
                                          o.status === "bank_transfer_rejected"  ? "거절" :
                                          "대기"
                                        }</span>
                                        {o.status === "paid" && (
                                          <button
                                            onClick={() => handleRefund(o.orderId)}
                                            disabled={refundLoading === o.orderId}
                                            className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-50 text-red-500 rounded hover:bg-red-100 disabled:opacity-50 border border-red-100 transition-colors"
                                          >
                                            <RotateCcw className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />
                                            {refundLoading === o.orderId ? "처리중" : "환불"}
                                          </button>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">
                                        {o.paidAt ? new Date(o.paidAt).toLocaleDateString("ko-KR") : new Date(o.createdAt).toLocaleDateString("ko-KR")}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ══ 크롤링 소스 ═══════════════════════════════════════════════════ */}
          {activeNav === "sources" && (
            <div className="max-w-2xl space-y-4">
              {/* 소스 추가 폼 */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <Rss className="w-4 h-4 text-blue-600" />새 크롤링 소스 추가
                  </p>
                  <p className="text-xs text-muted-foreground">크롤링할 사이트 URL을 추가하면 다음 크롤링부터 해당 소스에서 자동 수집합니다.</p>
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newSourceName.trim() || !newSourceUrl.trim()) return;
                      addSourceMutation.mutate({ name: newSourceName.trim(), url: newSourceUrl.trim() });
                    }}
                  >
                    <div className="flex gap-2">
                      <Input
                        placeholder="소스 이름 (예: 강릉시청 공지)"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        className="w-40 shrink-0"
                        required
                      />
                      <Input
                        placeholder="https://example.com/board/list"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        type="url"
                        className="flex-1"
                        required
                      />
                      <Button
                        type="submit"
                        className="shrink-0 bg-blue-600 hover:bg-blue-700"
                        disabled={addSourceMutation.isPending || !newSourceName.trim() || !newSourceUrl.trim()}
                      >
                        {addSourceMutation.isPending ? "추가 중..." : "추가"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* 소스 목록 */}
              {sourcesLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">소스 목록 불러오는 중...</div>
              ) : !sourcesData?.sources?.length ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    등록된 크롤링 소스가 없습니다. 위에서 소스를 추가해 주세요.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {sourcesData.sources.map((src) => (
                    <Card key={src.id} className={`transition-opacity ${src.enabled ? "" : "opacity-50"}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">{src.name}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${src.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                              {src.enabled ? "활성" : "비활성"}
                            </span>
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate block max-w-sm"
                          >
                            {src.url}
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 px-2.5 text-xs ${src.enabled ? "text-gray-600" : "text-green-700 border-green-200"}`}
                            onClick={() => toggleSourceMutation.mutate({ id: src.id, enabled: !src.enabled })}
                            disabled={toggleSourceMutation.isPending}
                          >
                            {src.enabled ? "비활성화" : "활성화"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => { if (confirm(`"${src.name}" 소스를 삭제하시겠습니까?`)) deleteSourceMutation.mutate(src.id); }}
                            disabled={deleteSourceMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* 안내 */}
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">크롤링 소스 안내</p>
                  <p>• 강릉시청 이달의 행사, 강릉아트센터, 강릉문화예술재단 URL은 전용 파서로 정확하게 수집됩니다.</p>
                  <p>• 그 외 URL은 범용 게시판 파서를 사용합니다 (제목·날짜 추출 정확도가 낮을 수 있음).</p>
                  <p>• 비활성화된 소스는 크롤링에서 제외됩니다.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ══ 스토리 ════════════════════════════════════════════════════════ */}
          {activeNav === "stories" && (
            <div className="space-y-3">
              {/* 네이버 블로그 키워드 수집 */}
              <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Rss className="w-3 h-3" />네이버 블로그 자동 수집
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Input className="h-7 text-xs flex-1 min-w-[140px]" placeholder="검색어 (예: 강릉 맛집, 강릉 카페)" value={naverQuery}
                    onChange={(e) => setNaverQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && naverQuery.trim() && !isNaverCrawling) handleNaverCrawl(); }} />
                  <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1 shrink-0"
                    disabled={!naverQuery.trim() || isNaverCrawling}
                    onClick={handleNaverCrawl}>
                    {isNaverCrawling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {isNaverCrawling ? "수집 중..." : "수집"}
                  </Button>
                </div>
                {/* 작성 기간 필터 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground shrink-0">작성 기간</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">최근</span>
                  <Input
                    type="number" min={1} max={999}
                    className="h-6 text-xs w-16 px-1.5"
                    value={naverPeriodValue}
                    onChange={(e) => setNaverPeriodValue(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <select
                    className="h-6 text-xs border rounded px-1 bg-white cursor-pointer"
                    value={naverPeriodUnit}
                    onChange={(e) => setNaverPeriodUnit(e.target.value as "days" | "months" | "years")}
                  >
                    <option value="days">일</option>
                    <option value="months">달</option>
                    <option value="years">년</option>
                  </select>
                  <span className="text-[10px] text-muted-foreground">이내 글만 수집</span>
                </div>
                <p className="text-[10px] text-muted-foreground">키워드로 네이버 블로그 전체에서 강릉 관련 글을 자동 수집합니다.</p>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 -mx-1 px-1 border-b border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">스토리 목록 <span className="font-semibold text-foreground">{storiesData?.stories?.length ?? 0}건</span></p>
                  {(storiesData?.stories?.length ?? 0) > 0 && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                        onClick={() => {
                          const allIds = storiesData!.stories.map(s => s.id);
                          if (selectedStoryIds.size === allIds.length) setSelectedStoryIds(new Set());
                          else setSelectedStoryIds(new Set(allIds));
                        }}>
                        {selectedStoryIds.size === (storiesData?.stories?.length ?? 0) ? "선택 해제" : "전체 선택"}
                      </Button>
                      {selectedStoryIds.size > 0 && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm(`선택한 ${selectedStoryIds.size}개를 삭제할까요?`)) return;
                            await fetch(`${BASE}/api/stories/bulk`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ids: [...selectedStoryIds] }) });
                            setSelectedStoryIds(new Set());
                            refetchStories();
                          }}>
                          <Trash2 className="w-3 h-3" />선택 삭제 ({selectedStoryIds.size})
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={async () => {
                          const total = storiesData?.stories?.length ?? 0;
                          if (!confirm(`스토리 전체 ${total}개를 삭제할까요?`)) return;
                          const allIds = storiesData!.stories.map(s => s.id);
                          await fetch(`${BASE}/api/stories/bulk`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ids: allIds }) });
                          setSelectedStoryIds(new Set());
                          refetchStories();
                        }}>
                        <Trash2 className="w-3 h-3" />모두 삭제
                      </Button>
                    </>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1"
                  disabled={storyImgRefetching}
                  onClick={async () => {
                    setStoryImgRefetching(true);
                    try {
                      const body: { ids?: string[] } = {};
                      if (selectedStoryIds.size > 0) body.ids = [...selectedStoryIds];
                      const r = await fetch(`${BASE}/api/stories/refetch-images`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(body),
                      });
                      const d = await r.json() as { message?: string; updated?: number; checked?: number };
                      toast({ description: d.message ?? "완료" });
                      if ((d.updated ?? 0) > 0) refetchStories();
                    } finally {
                      setStoryImgRefetching(false);
                    }
                  }}>
                  {storyImgRefetching
                    ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />처리 중...</>
                    : <><ImageIcon className="w-3 h-3" />{selectedStoryIds.size > 0 ? `이미지 재추출 (${selectedStoryIds.size})` : "이미지 재추출"}</>
                  }
                </Button>
                <Button size="sm" onClick={() => setShowStoryDialog(true)} className="h-7 px-3 text-xs gap-1">
                  <PlusCircle className="w-3 h-3" />직접 등록
                </Button>
              </div>
              {storiesLoading ? <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
                : !storiesData?.stories?.length ? (
                  <div className="py-16 text-center text-sm text-muted-foreground"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />등록된 스토리가 없습니다.</div>
                ) : storiesData.stories.map((s) => {
                  const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
                  return (
                    <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPreviewStory(s)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedStoryIds.has(s.id)}
                              onCheckedChange={(checked) => {
                                setSelectedStoryIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(s.id); else next.delete(s.id);
                                  return next;
                                });
                              }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.icon}{sc.label}</span>
                              {s.author && <span className="text-xs text-muted-foreground">{s.author}</span>}
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{s.title}</p>
                            {s.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.body}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{new Date(s.createdAt).toLocaleDateString("ko-KR")}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                            {s.status === "draft" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "approved" }) });
                                  refetchStories();
                                }}>
                                <CheckCircle className="w-3 h-3" />승인
                              </Button>
                            )}
                            {s.status === "approved" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-700 border-blue-200"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "published" }) });
                                  refetchStories();
                                }}>
                                <Send className="w-3 h-3" />발행
                              </Button>
                            )}
                            {s.status !== "draft" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "draft" }) });
                                  refetchStories();
                                }}>
                                검토중
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
                              title="썸네일 지정"
                              onClick={() => setEditingStoryThumb({ id: s.id, thumbUrl: s.thumbnailUrl ?? "" })}>
                              <ImageIcon className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (!confirm("삭제하시겠습니까?")) return;
                                await fetch(`${BASE}/api/stories/${s.id}`, { method: "DELETE", credentials: "include" });
                                refetchStories();
                              }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {/* 썸네일 편집 다이얼로그 */}
              {editingStoryThumb && (
                <Dialog open={!!editingStoryThumb} onOpenChange={() => setEditingStoryThumb(null)}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>썸네일 URL 지정</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                      <Input
                        placeholder="https://..."
                        value={editingStoryThumb.thumbUrl}
                        onChange={(e) => setEditingStoryThumb((prev) => prev ? { ...prev, thumbUrl: e.target.value } : null)}
                      />
                      {editingStoryThumb.thumbUrl && (
                        <img
                          src={editingStoryThumb.thumbUrl}
                          className="w-full h-32 object-cover rounded border"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditingStoryThumb(null)}>취소</Button>
                      <Button onClick={async () => {
                        await fetch(`${BASE}/api/stories/${editingStoryThumb.id}/thumbnail`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ thumbnailUrl: editingStoryThumb.thumbUrl || null }),
                        });
                        refetchStories();
                        setEditingStoryThumb(null);
                        toast({ description: "썸네일이 저장되었습니다" });
                      }}>저장</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* 새 스토리 다이얼로그 */}
              <Dialog open={showStoryDialog} onOpenChange={setShowStoryDialog}>
                <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
                  <DialogHeader><DialogTitle>새 스토리 등록</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    {/* 원문 링크 + 자동 추출 버튼 */}
                    <div>
                      <Label className="text-xs">원문 링크</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          className="h-8 text-sm flex-1"
                          value={storyForm.sourceUrl}
                          onChange={(e) => setStoryForm(f => ({ ...f, sourceUrl: e.target.value }))}
                          placeholder="https://blog.naver.com/..."
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs shrink-0"
                          disabled={!storyForm.sourceUrl.trim() || storyUrlExtracting}
                          onClick={async () => {
                            setStoryUrlExtracting(true);
                            try {
                              const r = await fetch(`${BASE}/api/stories/extract-url`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify({ url: storyForm.sourceUrl.trim() }),
                              });
                              const d = await r.json() as { title?: string; body?: string; images?: string[]; author?: string; error?: string };
                              if (!r.ok || d.error) { toast({ description: d.error ?? "추출 실패", variant: "destructive" }); return; }
                              setStoryForm(f => ({
                                ...f,
                                title: d.title || f.title,
                                body: d.body || f.body,
                                imagesStr: d.images?.length ? d.images.join(", ") : f.imagesStr,
                                author: d.author || f.author,
                              }));
                              toast({ description: "제목·본문·이미지를 자동으로 채웠습니다. 확인 후 수정하세요." });
                            } finally {
                              setStoryUrlExtracting(false);
                            }
                          }}
                        >
                          {storyUrlExtracting
                            ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : "자동 추출"}
                        </Button>
                      </div>
                    </div>
                    <div><Label className="text-xs">제목 *</Label><Input className="h-8 text-sm mt-1" value={storyForm.title} onChange={(e) => setStoryForm(f => ({ ...f, title: e.target.value }))} /></div>
                    <div><Label className="text-xs">본문</Label><Textarea className="text-sm mt-1 min-h-[80px]" value={storyForm.body} onChange={(e) => setStoryForm(f => ({ ...f, body: e.target.value }))} /></div>
                    <div><Label className="text-xs">이미지 URL (쉼표 구분)</Label><Input className="h-8 text-sm mt-1" value={storyForm.imagesStr} onChange={(e) => setStoryForm(f => ({ ...f, imagesStr: e.target.value }))} placeholder="https://..." /></div>
                    <div><Label className="text-xs">작성자/출처</Label><Input className="h-8 text-sm mt-1" value={storyForm.author} onChange={(e) => setStoryForm(f => ({ ...f, author: e.target.value }))} /></div>
                    <div><Label className="text-xs">태그 (쉼표 구분)</Label><Input className="h-8 text-sm mt-1" value={storyForm.tagsStr} onChange={(e) => setStoryForm(f => ({ ...f, tagsStr: e.target.value }))} placeholder="강릉,바다,카페" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => setShowStoryDialog(false)}>취소</Button>
                    <Button size="sm" disabled={!storyForm.title} onClick={async () => {
                      await fetch(`${BASE}/api/stories`, {
                        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                        body: JSON.stringify({
                          title: storyForm.title, body: storyForm.body,
                          images: storyForm.imagesStr.split(",").map(s => s.trim()).filter(Boolean),
                          sourceUrl: storyForm.sourceUrl, author: storyForm.author,
                          tags: storyForm.tagsStr.split(",").map(s => s.trim()).filter(Boolean),
                        }),
                      });
                      setStoryForm({ title: "", body: "", imagesStr: "", sourceUrl: "", author: "", tagsStr: "" });
                      setShowStoryDialog(false);
                      refetchStories();
                      toast({ description: "스토리가 등록됐습니다." });
                    }}>등록</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 스토리 미리보기 패널 */}
              <Sheet open={!!previewStory} onOpenChange={(o) => { if (!o) setPreviewStory(null); }}>
                <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
                  {previewStory && (() => {
                    const s = previewStory;
                    const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
                    return (
                      <>
                        {/* 이미지 */}
                        {s.images[0] && (
                          <div className="relative h-52 shrink-0 bg-gray-100 overflow-hidden">
                            <img src={s.images[0]} alt={s.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {/* 스크롤 영역 */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                          <SheetHeader>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.icon}{sc.label}</span>
                              {s.author && <span className="text-xs text-muted-foreground">{s.author}</span>}
                              <span className="text-xs text-muted-foreground ml-auto">{new Date(s.createdAt).toLocaleDateString("ko-KR")}</span>
                            </div>
                            <SheetTitle className="text-base leading-snug mt-1">{s.title}</SheetTitle>
                          </SheetHeader>
                          {s.body && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.body}</p>}
                          {s.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {s.tags.filter(Boolean).map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{t}</span>)}
                            </div>
                          )}
                        </div>
                        {/* 액션 푸터 */}
                        <div className="border-t p-4 flex flex-col gap-2 shrink-0">
                          {/* SNS 공유 버튼 (승인/발행 상태일 때) */}
                          {(s.status === "approved" || s.status === "published") && (() => {
                            const storySnsText = [
                              s.title,
                              s.body ? `\n${s.body}` : "",
                              s.tags?.length ? `\n\n${s.tags.filter(Boolean).map((t: string) => `#${t}`).join(" ")}` : "",
                              `\n\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`,
                            ].join("");
                            return (
                              <div className="space-y-1.5">
                                <p className="text-xs text-muted-foreground font-medium">문구가 클립보드에 복사되며 해당 플랫폼이 열립니다</p>
                                <div className="flex flex-wrap gap-2">
                                  <a href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR" target="_blank" rel="noopener noreferrer"
                                    onClick={() => { void navigator.clipboard.writeText(storySnsText); toast({ description: "문구가 복사됐습니다." }); }}>
                                    <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#1877F2] hover:bg-[#1565C0]">페이스북</Button>
                                  </a>
                                  <a href="https://www.instagram.com/playgangneung/" target="_blank" rel="noopener noreferrer"
                                    onClick={() => { void navigator.clipboard.writeText(storySnsText); toast({ description: "문구가 복사됐습니다." }); }}>
                                    <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#E1306C] hover:bg-[#C2185B]">인스타그램</Button>
                                  </a>
                                  <a href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR" target="_blank" rel="noopener noreferrer"
                                    onClick={() => { void navigator.clipboard.writeText(storySnsText); toast({ description: "문구가 복사됐습니다." }); }}>
                                    <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#3b5bdb] hover:bg-[#2f4ac4]">Meta Suite</Button>
                                  </a>
                                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs"
                                    onClick={() => { void navigator.clipboard.writeText(storySnsText); toast({ description: "문구가 복사됐습니다." }); }}>
                                    <Copy className="w-3 h-3 mr-1" />문구 복사
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                          {s.sourceUrl && (
                            <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full h-9 rounded-md border text-sm font-medium hover:bg-gray-50 transition-colors">
                              <ExternalLink className="w-4 h-4" />원문 보기
                            </a>
                          )}
                          <div className="flex gap-2">
                            {s.status === "draft" && (
                              <Button className="flex-1 gap-1" size="sm" variant="outline"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "approved" }) });
                                  refetchStories(); setPreviewStory(null);
                                }}>
                                <CheckCircle className="w-4 h-4 text-green-600" />승인
                              </Button>
                            )}
                            {s.status === "approved" && (
                              <Button className="flex-1 gap-1" size="sm"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "published" }) });
                                  refetchStories(); setPreviewStory(null);
                                }}>
                                <Send className="w-4 h-4" />발행
                              </Button>
                            )}
                            {s.status !== "draft" && (
                              <Button className="flex-1" size="sm" variant="outline"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/stories/${s.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status: "draft" }) });
                                  refetchStories(); setPreviewStory(null);
                                }}>
                                검토중으로
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 px-3"
                              onClick={async () => {
                                if (!confirm("삭제하시겠습니까?")) return;
                                await fetch(`${BASE}/api/stories/${s.id}`, { method: "DELETE", credentials: "include" });
                                refetchStories(); setPreviewStory(null);
                              }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </SheetContent>
              </Sheet>
            </div>
          )}

          {/* ══ 영상 ══════════════════════════════════════════════════════════ */}
          {activeNav === "videos" && (
            <div className="space-y-3">
              {/* 수집 컨트롤 */}
              <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-medium text-muted-foreground">YouTube 자동 수집</span>
                  <p className="text-xs text-muted-foreground">영상 목록 <span className="font-semibold text-foreground">{videosData?.videos?.length ?? 0}건</span></p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Input className="h-7 text-xs flex-1 min-w-[120px]" placeholder="검색어 (예: 강릉 카페)" value={ytCrawlQuery}
                    onChange={(e) => setYtCrawlQuery(e.target.value)} />
                  <Button size="sm" variant="outline" disabled={isCrawlingVideos} className="h-7 px-3 text-xs gap-1 shrink-0"
                    onClick={async () => {
                      setIsCrawlingVideos(true);
                      try {
                        const body: Record<string, unknown> = {
                          maxResults: 50,
                          period: { unit: ytPeriodUnit, value: ytPeriodValue },
                          query: ytCrawlQuery.trim() || "강릉",
                        };
                        const r = await fetch(`${BASE}/api/videos/crawl`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          credentials: "include", body: JSON.stringify(body),
                        });
                        const d = await r.json() as { message?: string; error?: string };
                        if (!r.ok) toast({ description: d.error ?? "수집 실패", variant: "destructive" });
                        else { toast({ description: d.message ?? "수집 완료" }); refetchVideos(); }
                      } catch { toast({ description: "수집 실패", variant: "destructive" }); }
                      finally { setIsCrawlingVideos(false); }
                    }}>
                    {isCrawlingVideos ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {isCrawlingVideos ? "수집 중..." : "수집"}
                  </Button>
                  <Button size="sm" onClick={() => setShowVideoDialog(true)} className="h-7 px-3 text-xs gap-1 shrink-0">
                    <PlusCircle className="w-3 h-3" />직접 등록
                  </Button>
                </div>
                {/* 작성 기간 필터 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground shrink-0">업로드 기간</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">최근</span>
                  <Input
                    type="number" min={1} max={999}
                    className="h-6 text-xs w-16 px-1.5"
                    value={ytPeriodValue}
                    onChange={(e) => setYtPeriodValue(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <select
                    className="h-6 text-xs border rounded px-1 bg-white cursor-pointer"
                    value={ytPeriodUnit}
                    onChange={(e) => setYtPeriodUnit(e.target.value as "days" | "months" | "years")}
                  >
                    <option value="days">일</option>
                    <option value="months">달</option>
                    <option value="years">년</option>
                  </select>
                  <span className="text-[10px] text-muted-foreground">이내 영상만 수집</span>
                </div>
              </div>
              {/* 영상 선택 툴바 */}
              {(videosData?.videos?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => {
                      const allIds = videosData!.videos.map(v => v.id);
                      if (selectedVideoIds.size === allIds.length) setSelectedVideoIds(new Set());
                      else setSelectedVideoIds(new Set(allIds));
                    }}>
                    {selectedVideoIds.size === (videosData?.videos?.length ?? 0) ? "선택 해제" : "전체 선택"}
                  </Button>
                  {selectedVideoIds.size > 0 && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        if (!confirm(`선택한 ${selectedVideoIds.size}개를 삭제할까요?`)) return;
                        await fetch(`${BASE}/api/videos/bulk`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ids: [...selectedVideoIds] }) });
                        setSelectedVideoIds(new Set());
                        refetchVideos();
                      }}>
                      <Trash2 className="w-3 h-3" />선택 삭제 ({selectedVideoIds.size})
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={async () => {
                      const total = videosData?.videos?.length ?? 0;
                      if (!confirm(`영상 전체 ${total}개를 삭제할까요?`)) return;
                      const allIds = videosData!.videos.map(v => v.id);
                      await fetch(`${BASE}/api/videos/bulk`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ids: allIds }) });
                      setSelectedVideoIds(new Set());
                      refetchVideos();
                    }}>
                    <Trash2 className="w-3 h-3" />모두 삭제
                  </Button>
                </div>
              )}
              {videosLoading ? <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>
                : !videosData?.videos?.length ? (
                  <div className="py-16 text-center text-sm text-muted-foreground"><Video className="w-8 h-8 mx-auto mb-2 opacity-30" />등록된 영상이 없습니다.</div>
                ) : videosData.videos.map((v) => {
                  const sc = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.draft;
                  const thumb = v.thumbnailUrl ?? (v.youtubeId ? `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg` : null);
                  const embedLabel = v.embeddable === null ? null : v.embeddable
                    ? { text: "앱 내 재생 가능", cls: "bg-green-50 text-green-700 border-green-200" }
                    : { text: "유튜브 이동만 가능", cls: "bg-orange-50 text-orange-700 border-orange-200" };
                  const viewLabel = v.viewCount != null
                    ? v.viewCount >= 10000
                      ? `${(v.viewCount / 10000).toFixed(1)}만회`
                      : `${v.viewCount.toLocaleString()}회`
                    : null;
                  return (
                    <Card key={v.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setPreviewVideo(v); setVideoSnsCaption(v.socialCaption || ""); }}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selectedVideoIds.has(v.id)}
                              onCheckedChange={(checked) => {
                                setSelectedVideoIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(v.id); else next.delete(v.id);
                                  return next;
                                });
                              }} />
                          </div>
                          {thumb && <img src={thumb} alt="" className="w-24 h-[54px] object-cover rounded-lg shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.icon}{sc.label}</span>
                              {embedLabel && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${embedLabel.cls}`}>
                                  {v.embeddable ? <CheckCircle className="w-3 h-3 mr-1" /> : <ExternalLink className="w-3 h-3 mr-1" />}
                                  {embedLabel.text}
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-sm line-clamp-1">{v.title || v.youtubeId}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {v.channelName && <span className="text-xs text-muted-foreground">{v.channelName}</span>}
                              {viewLabel && <span className="text-xs text-muted-foreground">· 조회 {viewLabel}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{new Date(v.createdAt).toLocaleDateString("ko-KR")}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (!confirm("삭제하시겠습니까?")) return;
                                await fetch(`${BASE}/api/videos/${v.id}`, { method: "DELETE", credentials: "include" });
                                refetchVideos();
                              }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {/* 새 영상 다이얼로그 */}
              <Dialog open={showVideoDialog} onOpenChange={(o) => { if (!o) { setVideoForm({ youtubeUrl: "", title: "", channelName: "", description: "" }); setVideoIsFetching(false); } setShowVideoDialog(o); }}>
                <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
                  <DialogHeader><DialogTitle>새 영상 등록</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label className="text-xs">YouTube URL 또는 영상 ID *</Label>
                      <Input
                        className="h-8 text-sm mt-1"
                        value={videoForm.youtubeUrl}
                        onChange={(e) => setVideoForm(f => ({ ...f, youtubeUrl: e.target.value, title: "", channelName: "", description: "" }))}
                        onBlur={async () => {
                          const raw = videoForm.youtubeUrl.trim();
                          if (!raw) return;
                          setVideoIsFetching(true);
                          try {
                            const r = await fetch(`${BASE}/api/videos/extract?url=${encodeURIComponent(raw)}`, { credentials: "include" });
                            if (r.ok) {
                              const info = await r.json() as { title?: string; channelName?: string; description?: string };
                              setVideoForm(f => ({ ...f, title: info.title || "", channelName: info.channelName || "", description: info.description || "" }));
                            }
                          } finally {
                            setVideoIsFetching(false);
                          }
                        }}
                        placeholder="https://youtu.be/xxxxx 또는 영상 ID"
                      />
                      {videoIsFetching && <p className="text-xs text-muted-foreground mt-1 animate-pulse">영상 정보 불러오는 중...</p>}
                    </div>
                    {(videoForm.title || videoForm.channelName || videoForm.description) && (
                      <>
                        <div><Label className="text-xs">제목</Label><Input className="h-8 text-sm mt-1" value={videoForm.title} onChange={(e) => setVideoForm(f => ({ ...f, title: e.target.value }))} /></div>
                        <div><Label className="text-xs">채널명</Label><Input className="h-8 text-sm mt-1" value={videoForm.channelName} onChange={(e) => setVideoForm(f => ({ ...f, channelName: e.target.value }))} /></div>
                        <div><Label className="text-xs">설명</Label><Textarea className="text-sm mt-1 min-h-[60px]" value={videoForm.description} onChange={(e) => setVideoForm(f => ({ ...f, description: e.target.value }))} /></div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => { setVideoForm({ youtubeUrl: "", title: "", channelName: "", description: "" }); setShowVideoDialog(false); }}>취소</Button>
                    <Button size="sm" disabled={!videoForm.youtubeUrl.trim() || videoIsFetching} onClick={async () => {
                      await fetch(`${BASE}/api/videos`, {
                        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                        body: JSON.stringify({
                          youtubeUrl: videoForm.youtubeUrl.trim(),
                          title: videoForm.title || undefined,
                          channelName: videoForm.channelName || undefined,
                          description: videoForm.description || undefined,
                        }),
                      });
                      setVideoForm({ youtubeUrl: "", title: "", channelName: "", description: "" });
                      setShowVideoDialog(false);
                      refetchVideos();
                      toast({ description: "영상이 등록됐습니다." });
                    }}>등록</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 영상 미리보기 패널 */}
              <Sheet open={!!previewVideo} onOpenChange={(o) => { if (!o) { setPreviewVideo(null); setVideoSnsCaption(""); } }}>
                <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
                  {previewVideo && (() => {
                    const v = previewVideo;
                    const sc = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.draft;
                    const isSnsMode = v.status === "approved" || v.status === "published";
                    const isPublished = v.status === "published";

                    return (
                      <>
                        {/* YouTube embed */}
                        {v.youtubeId && (
                          <div className="relative shrink-0 bg-black" style={{ paddingBottom: isSnsMode ? "40%" : "56.25%" }}>
                            <iframe
                              className="absolute inset-0 w-full h-full"
                              src={`https://www.youtube.com/embed/${v.youtubeId}`}
                              title={v.title}
                              allow="encrypted-media; fullscreen"
                              allowFullScreen
                            />
                          </div>
                        )}

                        {/* 상태 헤더 */}
                        <div className="px-5 pt-4 pb-2 flex items-center gap-2 border-b shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.icon}{sc.label}</span>
                          <p className="font-semibold text-sm line-clamp-1 flex-1 min-w-0">{v.title || v.youtubeId}</p>
                          <span className="text-xs text-muted-foreground shrink-0">{new Date(v.createdAt).toLocaleDateString("ko-KR")}</span>
                        </div>

                        {/* ── 상세보기 뷰 (draft / rejected) ── */}
                        {!isSnsMode && (
                          <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {v.channelName && <p className="text-xs text-muted-foreground font-medium">{v.channelName}</p>}
                            {v.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{v.description.slice(0, 500)}</p>
                            )}
                            <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                              <ExternalLink className="w-3 h-3" />YouTube에서 보기
                            </a>
                          </div>
                        )}

                        {/* ── SNS 발행 뷰 (approved / published) ── */}
                        {isSnsMode && (
                          <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">SNS 발행 문구</Label>
                              {isPublished ? (
                                <p className="text-sm leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg p-3 border">{videoSnsCaption || "(문구 없음)"}</p>
                              ) : (
                                <Textarea
                                  rows={8}
                                  className="text-sm leading-relaxed resize-none"
                                  value={videoSnsCaption}
                                  onChange={(e) => setVideoSnsCaption(e.target.value)}
                                  placeholder={`예시)\n🎬 강릉 핫플레이스 영상\n\n강릉의 아름다운 곳을 소개합니다.\n\n#강릉 #플레이강릉 #강릉여행`}
                                />
                              )}
                            </div>
                            {!isPublished && (
                              <Button size="sm" variant="outline" className="w-full text-xs"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/videos/${v.id}/caption`, {
                                    method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                    body: JSON.stringify({ caption: videoSnsCaption }),
                                  });
                                  toast({ description: "문구가 저장됐습니다." });
                                }}>
                                문구 저장
                              </Button>
                            )}
                            {isPublished && (
                              <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <Send className="w-4 h-4 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-700 font-medium">발행 완료된 영상입니다.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 액션 푸터 */}
                        <div className="border-t p-4 shrink-0 space-y-2">
                          {/* 상세보기 푸터: 승인 + 삭제 */}
                          {!isSnsMode && (
                            <div className="flex gap-2">
                              <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white" size="sm"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/videos/${v.id}/status`, {
                                    method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                    body: JSON.stringify({ status: "approved" }),
                                  });
                                  const defaultCaption = `🎬 ${v.title}\n\n${v.description ? v.description.slice(0, 150) + (v.description.length > 150 ? "..." : "") : ""}\n\n👉 https://youtu.be/${v.youtubeId}\n\n#강릉 #플레이강릉 #강릉여행 #강릉핫플`;
                                  setVideoSnsCaption(v.socialCaption || defaultCaption);
                                  setPreviewVideo({ ...v, status: "approved" });
                                  refetchVideos();
                                }}>
                                <CheckCircle className="w-4 h-4" />승인 — SNS 발행 준비
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 px-3"
                                onClick={async () => {
                                  if (!confirm("삭제하시겠습니까?")) return;
                                  await fetch(`${BASE}/api/videos/${v.id}`, { method: "DELETE", credentials: "include" });
                                  refetchVideos(); setPreviewVideo(null); setVideoSnsCaption("");
                                }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {/* SNS 발행 푸터: 플랫폼 버튼들 */}
                          {isSnsMode && !isPublished && (
                            <>
                              <p className="text-xs text-muted-foreground font-medium">문구가 클립보드에 복사되며 해당 플랫폼이 열립니다</p>
                              <div className="flex flex-wrap gap-2">
                                <a href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR" target="_blank" rel="noopener noreferrer"
                                  onClick={() => navigator.clipboard.writeText(`${videoSnsCaption}\n\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`)}>
                                  <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#1877F2] hover:bg-[#1565C0]">페이스북</Button>
                                </a>
                                <a href="https://www.instagram.com/playgangneung/" target="_blank" rel="noopener noreferrer"
                                  onClick={() => navigator.clipboard.writeText(`${videoSnsCaption}\n\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`)}>
                                  <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#E1306C] hover:bg-[#C2185B]">인스타그램</Button>
                                </a>
                                <a href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR" target="_blank" rel="noopener noreferrer"
                                  onClick={() => navigator.clipboard.writeText(`${videoSnsCaption}\n\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`)}>
                                  <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#3b5bdb] hover:bg-[#2f4ac4]">Meta Suite</Button>
                                </a>
                                <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" className="h-8 px-3 text-xs text-white bg-[#FF0000] hover:bg-[#CC0000]">YouTube</Button>
                                </a>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="outline" className="flex-1 text-xs"
                                  onClick={async () => {
                                    await fetch(`${BASE}/api/videos/${v.id}/status`, {
                                      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                      body: JSON.stringify({ status: "draft" }),
                                    });
                                    setPreviewVideo({ ...v, status: "draft" });
                                    refetchVideos();
                                  }}>
                                  검토중으로
                                </Button>
                                <Button size="sm" className="flex-1 gap-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs"
                                  onClick={async () => {
                                    await fetch(`${BASE}/api/videos/${v.id}/caption`, {
                                      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                      body: JSON.stringify({ caption: videoSnsCaption }),
                                    });
                                    await fetch(`${BASE}/api/videos/${v.id}/status`, {
                                      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                      body: JSON.stringify({ status: "published" }),
                                    });
                                    refetchVideos(); setPreviewVideo(null); setVideoSnsCaption("");
                                    toast({ description: "발행 완료됐습니다." });
                                  }}>
                                  <Send className="w-3.5 h-3.5" />발행완료
                                </Button>
                              </div>
                            </>
                          )}

                          {/* 발행완료 푸터 */}
                          {isPublished && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 text-xs"
                                onClick={async () => {
                                  await fetch(`${BASE}/api/videos/${v.id}/status`, {
                                    method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                                    body: JSON.stringify({ status: "approved" }),
                                  });
                                  setPreviewVideo({ ...v, status: "approved" });
                                  refetchVideos();
                                }}>
                                다시 편집
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 px-3"
                                onClick={async () => {
                                  if (!confirm("삭제하시겠습니까?")) return;
                                  await fetch(`${BASE}/api/videos/${v.id}`, { method: "DELETE", credentials: "include" });
                                  refetchVideos(); setPreviewVideo(null); setVideoSnsCaption("");
                                }}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </SheetContent>
              </Sheet>
            </div>
          )}

          {/* ══ 설정 ══════════════════════════════════════════════════════════ */}
          {activeNav === "settings" && (
            <div className="max-w-lg space-y-4">

              {/* ── Meta 연동 토큰 관리 ─────────────────────────────── */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-blue-600 font-bold text-base">f</span> Meta 연동 토큰
                  </p>

                  {/* 현재 상태 표시 */}
                  {metaTokenStatusQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground animate-pulse">토큰 상태 확인 중...</p>
                  ) : metaTokenStatusQuery.data ? (
                    <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
                      metaTokenStatusQuery.data.valid
                        ? "text-green-700 bg-green-50 border-green-200"
                        : "text-red-700 bg-red-50 border-red-200"
                    }`}>
                      {metaTokenStatusQuery.data.valid ? (
                        <><CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>토큰이 유효합니다 (출처: {metaTokenStatusQuery.data.source === "db" ? "DB 저장" : "환경변수"})</span></>
                      ) : (
                        <><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{metaTokenStatusQuery.data.userMsg ?? "토큰이 유효하지 않습니다."}</span></>
                      )}
                    </div>
                  ) : null}

                  {/* 토큰 갱신 폼 */}
                  {metaTokenOpen ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Meta Business Suite → 시스템 사용자 → 액세스 토큰 생성에서 새 토큰을 발급하세요.
                      </p>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-xs font-mono h-20 resize-none"
                        placeholder="EAAxxxx... (새 Meta 액세스 토큰 붙여넣기)"
                        value={metaTokenInput}
                        onChange={(e) => setMetaTokenInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                          disabled={!metaTokenInput.trim() || saveMetaTokenMutation.isPending}
                          onClick={() => saveMetaTokenMutation.mutate(metaTokenInput.trim())}
                        >
                          {saveMetaTokenMutation.isPending ? "검증 및 저장 중..." : "저장"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setMetaTokenOpen(false); setMetaTokenInput(""); }}>
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={metaTokenStatusQuery.data?.valid ? "outline" : "default"}
                      className={metaTokenStatusQuery.data?.valid ? "" : "bg-red-600 hover:bg-red-700 text-white"}
                      onClick={() => setMetaTokenOpen(true)}
                    >
                      {metaTokenStatusQuery.data?.valid ? "토큰 교체" : "Meta 계정 다시 연결"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* 자동 크롤링 시간 설정 */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />자동 크롤링 시간 설정
                  </p>
                  <p className="text-sm text-muted-foreground">
                    매일 지정한 시간에 자동으로 강릉 콘텐츠를 수집합니다. 변경 시 다음 날부터 적용됩니다.
                  </p>
                  {scheduleData && (
                    <p className="text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2 border">
                      현재 설정: 매일 <strong>{String(scheduleData.crawlHour).padStart(2,"0")}:{String(scheduleData.crawlMinute).padStart(2,"0")}</strong> (한국 시간)
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">시 (0–23)</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={scheduleHour}
                        onChange={(e) => setScheduleHour(Number(e.target.value))}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2, "0")}시</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs text-muted-foreground">분</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={scheduleMinute}
                        onChange={(e) => setScheduleMinute(Number(e.target.value))}
                      >
                        {[0, 10, 20, 30, 40, 50].map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    disabled={saveScheduleMutation.isPending}
                    onClick={() => saveScheduleMutation.mutate({ hour: scheduleHour, minute: scheduleMinute })}
                  >
                    <Clock className="w-4 h-4" />
                    {saveScheduleMutation.isPending ? "저장 중..." : `${String(scheduleHour).padStart(2,"0")}:${String(scheduleMinute).padStart(2,"0")} 으로 저장`}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-purple-600" />카드이미지 일괄 생성</p>
                  <p className="text-sm text-muted-foreground">승인·발행된 기존 이벤트 전체의 카드이미지(1080×1080)를 생성합니다. 시간이 걸릴 수 있습니다.</p>
                  {generateCardsBatchMutation.data && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {`${generateCardsBatchMutation.data.generated}건 생성 완료 (전체 ${generateCardsBatchMutation.data.total}건)`}
                    </div>
                  )}
                  <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={() => generateCardsBatchMutation.mutate()} disabled={generateCardsBatchMutation.isPending}>
                    <ImageIcon className={`w-4 h-4 ${generateCardsBatchMutation.isPending ? "animate-pulse" : ""}`} />
                    {generateCardsBatchMutation.isPending ? "생성 중... (잠시 기다려 주세요)" : "일괄 생성"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600" />SNS 초안 링크 일괄 재생성 (이벤트)</p>
                  <p className="text-sm text-muted-foreground">기존 이벤트 초안의 출처 URL을 /content/:id 상세 링크로 일괄 업데이트합니다.</p>
                  {regenerateDraftsMutation.data && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {regenerateDraftsMutation.data.regenerated === 0 ? "모든 초안이 이미 최신입니다." : `${regenerateDraftsMutation.data.regenerated}건 업데이트 완료`}
                    </div>
                  )}
                  <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => regenerateDraftsMutation.mutate()} disabled={regenerateDraftsMutation.isPending}>
                    <RefreshCw className={`w-4 h-4 ${regenerateDraftsMutation.isPending ? "animate-spin" : ""}`} />
                    {regenerateDraftsMutation.isPending ? "재생성 중..." : "일괄 재생성"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-orange-600" />원문보기 링크 일괄 추가 (광고접수)</p>
                  <p className="text-sm text-muted-foreground">광고접수 초안에 원문보기 링크(/content/:id)가 없는 항목을 일괄 업데이트합니다.</p>
                  {regenerateAdDraftsMutation.data && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {regenerateAdDraftsMutation.data.regenerated === 0 ? "모든 광고 초안이 이미 최신입니다." : `${regenerateAdDraftsMutation.data.regenerated}건 원문링크 추가 완료`}
                    </div>
                  )}
                  <Button className="w-full gap-2 bg-orange-600 hover:bg-orange-700" onClick={() => regenerateAdDraftsMutation.mutate()} disabled={regenerateAdDraftsMutation.isPending}>
                    <RefreshCw className={`w-4 h-4 ${regenerateAdDraftsMutation.isPending ? "animate-spin" : ""}`} />
                    {regenerateAdDraftsMutation.isPending ? "재생성 중..." : "광고접수 원문링크 추가"}
                  </Button>
                </CardContent>
              </Card>
              {/* 배너 관리 */}
              <Card>
                <CardContent className="p-5 space-y-5">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-orange-500" />배너 관리
                  </p>
                  <p className="text-xs text-muted-foreground">공개 홈페이지에 표시되는 배너 문구를 직접 수정하세요. 저장하면 즉시 반영됩니다.</p>

                  {/* 배너 1 */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white">배너 1</span>
                      <span className="text-xs text-muted-foreground">홈 상단 · 다크 배너 (스토리 위)</span>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">작은 제목 (윗줄)</Label>
                      <Input className="mt-1" value={bannerForm.banner1Sub} onChange={(e) => setBannerForm((p) => ({ ...p, banner1Sub: e.target.value }))} placeholder="지역 소상공인을 위한" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">큰 제목 (아랫줄)</Label>
                      <Input className="mt-1" value={bannerForm.banner1Title} onChange={(e) => setBannerForm((p) => ({ ...p, banner1Title: e.target.value }))} placeholder="공동광고 지원센터" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">버튼 텍스트</Label>
                      <Input className="mt-1" value={bannerForm.banner1Cta} onChange={(e) => setBannerForm((p) => ({ ...p, banner1Cta: e.target.value }))} placeholder="지금 바로 시작하기 →" />
                    </div>
                    {/* 미리보기 */}
                    <div className="rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-4 py-3 flex items-center justify-center gap-3 text-xs">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{bannerForm.banner1Sub || "지역 소상공인을 위한"}</p>
                        <p className="text-sm font-extrabold text-white">{bannerForm.banner1Title || "공동광고 지원센터"}</p>
                      </div>
                      <span className="shrink-0 bg-orange-500 text-white font-bold text-[10px] rounded-lg px-2 py-1.5 text-center leading-tight whitespace-pre-line">{bannerForm.banner1Cta || "지금 바로\n시작하기 →"}</span>
                    </div>
                  </div>

                  {/* 배너 2 */}
                  <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white">배너 2</span>
                      <span className="text-xs text-muted-foreground">카드 목록 중간 · 주황색 배너</span>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">배너 문구</Label>
                      <Input className="mt-1" value={bannerForm.banner2Badge} onChange={(e) => setBannerForm((p) => ({ ...p, banner2Badge: e.target.value }))} placeholder="📢 공동광고 모집중" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">버튼 텍스트</Label>
                      <Input className="mt-1" value={bannerForm.banner2Cta} onChange={(e) => setBannerForm((p) => ({ ...p, banner2Cta: e.target.value }))} placeholder="참여하기 →" />
                    </div>
                    {/* 미리보기 */}
                    <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 flex items-center justify-center gap-4 text-xs">
                      <p className="text-sm font-bold text-white">{bannerForm.banner2Badge || "📢 공동광고 모집중"}</p>
                      <span className="text-xs font-semibold bg-white/20 rounded-lg px-3 py-1.5 text-white whitespace-nowrap">{bannerForm.banner2Cta || "참여하기 →"}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2 bg-orange-500 hover:bg-orange-600"
                    disabled={saveBannerMutation.isPending}
                    onClick={() => saveBannerMutation.mutate(bannerForm)}
                  >
                    {saveBannerMutation.isPending ? "저장 중..." : "배너 설정 저장"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="font-semibold text-sm flex items-center gap-2 mb-4"><KeyRound className="w-4 h-4 text-blue-600" />비밀번호 변경</p>
                  <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    if (pwForm.next !== pwForm.confirm) { toast({ title: "새 비밀번호가 일치하지 않습니다", variant: "destructive" }); return; }
                    if (pwForm.next.length < 4) { toast({ title: "4자 이상이어야 합니다", variant: "destructive" }); return; }
                    changePwMutation.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next });
                  }}>
                    <div className="space-y-1"><Label>현재 비밀번호</Label><Input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>새 비밀번호</Label><Input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>새 비밀번호 확인</Label><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} /></div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={changePwMutation.isPending || !pwForm.current || !pwForm.next}>
                      {changePwMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ══ 회원 관리 ══════════════════════════════════════════════════════ */}
          {activeNav === "members" && (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold">회원 관리</h2>
                <span className="ml-2 text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
                  소식 제보·광고 접수 회원
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                소식 제보 또는 광고를 접수한 회원 목록입니다. 닉네임은 회원이 자유롭게 설정한 표시 이름이며, 회원 ID(Clerk)로 실제 계정을 확인할 수 있습니다.
              </p>

              {membersLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">불러오는 중...</div>
              ) : !membersData?.members?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Activity className="w-10 h-10 opacity-20" />
                  <p className="text-sm">아직 제보 또는 광고를 접수한 회원이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {membersData.members.map((m) => (
                    <Card key={m.userId} className="overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedMember(expandedMember === m.userId ? null : m.userId)}
                      >
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-indigo-600">
                            {(m.displayName || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">
                              {m.displayName || <span className="text-gray-400 italic">닉네임 없음</span>}
                            </span>
                            {m.tipCount > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">
                                제보 {m.tipCount}건
                              </span>
                            )}
                            {m.adCount > 0 && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                                광고 {m.adCount}건
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            ID: {m.userId.slice(0, 24)}... · 마지막 활동: {new Date(m.lastActivity).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedMember === m.userId ? "rotate-90" : ""}`} />
                      </div>

                      {expandedMember === m.userId && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                          {/* 실제 Clerk 회원 ID */}
                          <div className="text-xs text-gray-500 font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 break-all">
                            <span className="text-gray-400 mr-1">Clerk 회원 ID:</span>{m.userId}
                          </div>

                          {/* 소식 제보 내역 */}
                          {m.tips.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-600 mb-1.5">📝 소식 제보 ({m.tips.length}건)</p>
                              <div className="space-y-1.5">
                                {m.tips.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_CONFIG[t.status]?.cls ?? "bg-gray-100 text-gray-500"}`}>
                                      {STATUS_CONFIG[t.status]?.label ?? t.status}
                                    </span>
                                    <span className="text-xs text-gray-800 flex-1 truncate">{t.title}</span>
                                    <span className="text-[10px] text-gray-400 shrink-0">{new Date(t.crawledAt).toLocaleDateString("ko-KR")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 광고 접수 내역 */}
                          {m.ads.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-600 mb-1.5">📢 광고 접수 ({m.ads.length}건)</p>
                              <div className="space-y-1.5">
                                {m.ads.map((a) => (
                                  <div key={a.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${AD_STATUS[a.status]?.cls ?? "bg-gray-100 text-gray-500"}`}>
                                      {AD_STATUS[a.status]?.label ?? a.status}
                                    </span>
                                    <span className="text-xs text-gray-800 flex-1 truncate">{a.title || a.businessName}</span>
                                    <span className="text-[10px] text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleDateString("ko-KR")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ══ 오늘의 강릉 TOP 5 관리 ════════════════════════════════════════ */}
          {activeNav === "top5" && (() => {
            const candidates = (top5EventsData?.events ?? []).filter((ev) => {
              const isApproved = ev.status === "approved" || ev.status === "published";
              const q = top5Search.trim().toLowerCase();
              return isApproved && (!q || ev.title.toLowerCase().includes(q));
            });
            const draftIds = new Set(top5Draft.map((d) => d.eventId));

            const addToSlot = (ev: { id: string; title: string; thumbnail: string | null }) => {
              if (draftIds.has(ev.id)) return;
              if (top5Draft.length >= 5) return;
              setTop5Draft((prev) => [...prev, { eventId: ev.id, rank: prev.length + 1, title: ev.title, thumbnail: ev.thumbnail }]);
            };

            const removeFromSlot = (eventId: string) => {
              setTop5Draft((prev) => prev.filter((d) => d.eventId !== eventId).map((d, i) => ({ ...d, rank: i + 1 })));
            };

            const loadTodayIntoSlot = () => {
              const items = top5TodayData?.items ?? [];
              if (items.length === 0) return;
              setTop5Draft(items.map((it) => ({ eventId: it.eventId, rank: it.rank, title: it.title, thumbnail: it.thumbnail })));
            };

            const isValidThumb = (thumb: string | null) =>
              !!thumb && (thumb.startsWith("http://") || thumb.startsWith("https://"));

            const saveTop5 = async () => {
              const noImgSlots = top5Draft.filter((d) => !isValidThumb(d.thumbnail));
              if (noImgSlots.length > 0) {
                toast({
                  title: `⚠️ 이미지 없는 카드 ${noImgSlots.length}개 포함`,
                  description: `rank ${noImgSlots.map((d) => d.rank).join(", ")}: 대표 이미지가 없습니다. 저장은 계속됩니다.`,
                  variant: "destructive",
                });
              }
              setTop5Saving(true);
              try {
                const r = await fetch(`${BASE}/api/top5`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ date: top5DraftDate, items: top5Draft.map((d) => ({ eventId: d.eventId, rank: d.rank })) }),
                });
                if (!r.ok) throw new Error("저장 실패");
                toast({ title: "✅ TOP 5 저장 완료", description: `${top5DraftDate} TOP 5가 저장되었습니다.` });
                await refetchTop5Today();
              } catch {
                toast({ title: "저장 실패", variant: "destructive" });
              } finally {
                setTop5Saving(false);
              }
            };

            const sendCarouselToMeta = async () => {
              if (top5Draft.length === 0) return;
              setTop5CarouselSending(true);
              try {
                const cards = top5Draft.map((slot) => ({
                  title: slot.title,
                  summary: slot.title,
                  imageUrl: slot.thumbnail ?? "",
                  linkUrl: `${window.location.origin}/content/${slot.eventId}`,
                }));
                const r = await fetch(`${BASE}/api/top5/carousel-to-meta`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ cards }),
                });
                const data = await r.json() as { ok?: boolean; postId?: string; photoCount?: number; error?: string; tokenExpired?: boolean; devError?: string };
                if (!r.ok) {
                  if (data.tokenExpired) {
                    console.error("[Meta API] 토큰 만료:", data.devError);
                    qc.invalidateQueries({ queryKey: ["meta-token-status"] });
                  }
                  throw new Error(data.error ?? "전송 실패");
                }
                toast({ title: "✅ Meta 게시 완료", description: `게시물 ID: ${data.postId} (사진 ${data.photoCount}장)` });
                setTop5CarouselOpen(false);
              } catch (err) {
                toast({
                  title: "Meta 전송 실패",
                  description: err instanceof Error ? err.message : "오류 발생",
                  variant: "destructive",
                });
              } finally {
                setTop5CarouselSending(false);
              }
            };

            return (
              <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-bold">오늘의 강릉 TOP 5</h2>
                  <span className="ml-2 text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">홈 상단 노출</span>
                </div>
                <p className="text-sm text-muted-foreground">승인된 이벤트를 최대 5개 선정하여 홈 상단 "오늘의 강릉 TOP 5" 섹션에 노출합니다. 선정 후 다음 날 자동으로 일반 피드로 이동합니다.</p>

                {/* 날짜 선택 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">날짜</label>
                  <input
                    type="date"
                    value={top5DraftDate}
                    onChange={(e) => { setTop5DraftDate(e.target.value); setTop5Draft([]); }}
                    className="border rounded-lg px-2 py-1.5 text-sm"
                  />
                  {top5TodayData && top5TodayData.items.length > 0 && (
                    <Button size="sm" variant="outline" onClick={loadTodayIntoSlot} className="text-xs">
                      저장된 TOP 5 불러오기 ({top5TodayData.items.length}개)
                    </Button>
                  )}
                </div>

                {/* 현재 슬롯 */}
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-gray-600 mb-3">선정된 TOP 5 ({top5Draft.length}/5)</p>
                    <div className="space-y-2 min-h-[120px]">
                      {top5Draft.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-1">
                          <Trophy className="w-8 h-8 opacity-20" />
                          <p className="text-xs">아래 목록에서 이벤트를 선택하세요</p>
                        </div>
                      ) : (
                        top5Draft.map((slot, i) => (
                          <div key={slot.eventId} className={`flex items-center gap-3 p-2 rounded-lg border ${!isValidThumb(slot.thumbnail) ? "bg-orange-50 border-orange-200" : "bg-gray-50"}`}>
                            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${i === 0 ? "bg-yellow-400 text-yellow-900" : i === 1 ? "bg-gray-300 text-gray-700" : i === 2 ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                              {slot.rank}
                            </span>
                            <button
                              type="button"
                              title={isValidThumb(slot.thumbnail) ? "이미지 변경" : "이미지 없음 — 클릭하여 설정"}
                              onClick={() => { setTop5ThumbEdit({ eventId: slot.eventId, title: slot.title }); setTop5ThumbInput(slot.thumbnail ?? ""); }}
                              className={`relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-dashed group ${isValidThumb(slot.thumbnail) ? "border-blue-300 hover:border-blue-500" : "border-orange-400 hover:border-orange-600"}`}
                            >
                              {isValidThumb(slot.thumbnail) ? (
                                <img key={slot.thumbnail!} src={proxyAdminImg(slot.thumbnail!)} alt="" className="w-full h-full object-cover"
                                  onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) img.src = slot.thumbnail!; else img.style.display = "none"; }} />
                              ) : (
                                <span className="text-lg">⚠️</span>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-white text-[9px] font-bold">{isValidThumb(slot.thumbnail) ? "변경" : "설정"}</span>
                              </div>
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium line-clamp-1">{slot.title}</span>
                              {!isValidThumb(slot.thumbnail) && (
                                <p className="text-[10px] text-orange-500 font-medium mt-0.5">이미지 없음 — 홈 카드에 이모지가 표시됩니다</p>
                              )}
                            </div>
                            <button onClick={() => removeFromSlot(slot.eventId)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        disabled={top5Draft.length === 0 || top5Saving}
                        onClick={saveTop5}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        {top5Saving ? "저장 중..." : "💾 TOP 5 저장"}
                      </Button>
                      {top5Draft.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setTop5Draft([])}>초기화</Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTop5CarouselOpen(true)}
                        className="ml-auto border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        📣 Meta/SNS 캐러셀
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 이벤트 검색 + 목록 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-sm font-semibold text-gray-700">승인된 이벤트 목록</p>
                    <span className="text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded-full">{candidates.length}개</span>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="이벤트 검색..."
                      value={top5Search}
                      onChange={(e) => setTop5Search(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {candidates.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">승인된 이벤트가 없습니다</div>
                    ) : (
                      candidates.map((ev) => {
                        const isSelected = draftIds.has(ev.id);
                        return (
                          <button
                            key={ev.id}
                            disabled={isSelected || top5Draft.length >= 5}
                            onClick={() => addToSlot(ev)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${isSelected ? "bg-yellow-50 border-yellow-200 opacity-60 cursor-default" : top5Draft.length >= 5 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}
                          >
                            {ev.thumbnail ? (
                              <img key={ev.thumbnail} src={proxyAdminImg(ev.thumbnail)} alt="" className="w-10 h-10 object-cover rounded-lg shrink-0"
                                onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) img.src = ev.thumbnail!; else img.style.display = "none"; }} />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center text-sm">🏖️</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-1">{ev.title}</p>
                              <p className="text-xs text-muted-foreground">{ev.category} · {ev.startDate || "날짜 미상"}</p>
                            </div>
                            {isSelected ? (
                              <span className="shrink-0 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">선정됨</span>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isValidThumb(ev.thumbnail) && (
                                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">이미지 없음</span>
                                )}
                                {top5Draft.length < 5 && <PlusCircle className="w-5 h-5 text-blue-400" />}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              {/* ── Meta/SNS 캐러셀 초안 모달 ── */}
              {top5CarouselOpen && (
                <Dialog open onOpenChange={setTop5CarouselOpen}>
                  <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <span>📣</span> Meta/SNS 캐러셀 초안
                      </DialogTitle>
                    </DialogHeader>
                    {top5Draft.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        <p className="text-sm">선택된 항목이 없습니다.</p>
                        <p className="text-xs mt-1">TOP 5 슬롯에 이벤트를 먼저 추가해 주세요.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 py-1">
                        {top5Draft.map((slot) => (
                          <div key={slot.eventId} className="flex gap-3 p-3 border rounded-lg bg-gray-50">
                            <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border bg-gray-200 flex items-center justify-center">
                              {isValidThumb(slot.thumbnail) ? (
                                <img src={proxyAdminImg(slot.thumbnail!)} alt="" className="w-full h-full object-cover"
                                  onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) img.src = slot.thumbnail!; else img.src = "/logo.png"; }} />
                              ) : (
                                <span className="text-2xl">🏖️</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full">#{slot.rank}</span>
                              </div>
                              <p className="text-sm font-semibold line-clamp-2 leading-snug">{slot.title}</p>
                              <p className="text-xs text-gray-400 mt-1 truncate">{window.location.origin}/content/{slot.eventId}</p>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground pt-1">총 {top5Draft.length}개 카드 · Meta 페이지에 이미지 포함 게시물로 업로드됩니다.</p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => setTop5CarouselOpen(false)}>닫기</Button>
                      {top5Draft.length > 0 && (
                        <Button
                          size="sm"
                          disabled={top5CarouselSending}
                          onClick={sendCarouselToMeta}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {top5CarouselSending ? "전송 중..." : "📤 Meta에 연동"}
                        </Button>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              </div>
            );
          })()}
        </main>
      </div>
    </div>

    {/* ══ 이벤트 수정 다이얼로그 ════════════════════════════════════════════ */}
    {editingEvent && (
      <Dialog open onOpenChange={(o) => { if (!o) setEditingEvent(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-600" />이벤트 수정</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            editEventMutation.mutate({ id: editingEvent.id, patch: {
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              thumbnail: (fd.get("thumbnail") as string) || undefined,
              videoUrl: (fd.get("videoUrl") as string) || null,
              location: fd.get("location") as string,
              category: fd.get("category") as string,
              startDate: fd.get("startDate") as string,
              endDate: fd.get("endDate") as string,
              contentBlocks: editBlocks.length > 0 ? editBlocks : null,
            }});
          }}>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">대표 이미지 URL
                {!editThumbnailUrl && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5"><AlertTriangle className="w-3 h-3" />이미지 없음</span>}
              </Label>
              <Input name="thumbnail" value={editThumbnailUrl} onChange={(e) => setEditThumbnailUrl(e.target.value)} placeholder="https://example.com/image.jpg" className={!editThumbnailUrl ? "border-orange-300" : ""} />
              {editThumbnailUrl && <div className="rounded-lg overflow-hidden border h-32 bg-gray-50"><img key={editThumbnailUrl} src={proxyAdminImg(editThumbnailUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) { img.src = editThumbnailUrl; } else { img.style.display = "none"; } }} /></div>}
            </div>
            <div className="space-y-2">
              <Label>동영상 URL (유튜브·MP4·릴스 링크)</Label>
              <Input name="videoUrl" defaultValue={(editingEvent as any).videoUrl ?? ""} placeholder="https://youtu.be/... 또는 https://example.com/video.mp4" />
              <p className="text-xs text-muted-foreground">유튜브 링크는 자동으로 임베드, MP4는 플레이어로 표시됩니다.</p>
            </div>
            <div className="space-y-1"><Label>제목</Label><Input name="title" defaultValue={editingEvent.title} required /></div>
            <div className="space-y-1"><Label>문의처</Label><Input name="contact" defaultValue={(editingEvent as any).contact ?? ""} placeholder="예: 강릉시청 문화예술과 033-000-0000" /></div>
            <div className="space-y-1"><Label>설명</Label><Textarea name="description" rows={3} defaultValue={editingEvent.description} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>장소</Label><Input name="location" defaultValue={editingEvent.location ?? ""} /></div>
              <div className="space-y-1"><Label>카테고리</Label>
                <select name="category" defaultValue={editingEvent.category ?? "행사"} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="행사">행사</option><option value="맛집">맛집</option><option value="핫플">핫플</option><option value="지역소식">지역소식</option>
                </select>
              </div>
              <div className="space-y-1"><Label>시작일</Label><Input name="startDate" type="date" defaultValue={editingEvent.startDate ?? editingEvent.date} /></div>
              <div className="space-y-1"><Label>종료일</Label><Input name="endDate" type="date" defaultValue={editingEvent.endDate ?? ""} /></div>
            </div>

            {/* 콘텐츠 블록 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold">
                <PlusCircle className="w-4 h-4 text-blue-500" />
                추가 콘텐츠 블록
                <span className="text-[11px] font-normal text-muted-foreground">사진·영상 아래에 표시</span>
              </Label>
              {editBlocks.length > 0 && (
                <div className="space-y-2">
                  {editBlocks.map((block, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mt-0.5 w-10 shrink-0">
                        {block.type === "text" ? "텍스트" : block.type === "image" ? "이미지" : "영상"}
                      </span>
                      <p className="text-xs text-slate-600 flex-1 line-clamp-2 break-all">{block.content}</p>
                      <button type="button" onClick={() => setEditBlocks((b) => b.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 shrink-0 mt-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-start">
                <select
                  value={addBlockType}
                  onChange={(e) => setAddBlockType(e.target.value as ContentBlock["type"])}
                  className="border border-input rounded-md px-2 py-2 text-xs bg-background focus:outline-none shrink-0"
                >
                  <option value="text">텍스트</option>
                  <option value="image">이미지 URL</option>
                  <option value="video">영상 URL</option>
                </select>
                <textarea
                  value={addBlockContent}
                  onChange={(e) => setAddBlockContent(e.target.value)}
                  placeholder={addBlockType === "text" ? "추가할 텍스트를 입력하세요..." : "https://..."}
                  rows={addBlockType === "text" ? 3 : 1}
                  className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    const content = addBlockContent.trim();
                    if (!content) return;
                    setEditBlocks((b) => [...b, { type: addBlockType, content }]);
                    setAddBlockContent("");
                  }}
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />추가
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingEvent(null)}>취소</Button>
              <Button type="submit" disabled={editEventMutation.isPending}>{editEventMutation.isPending ? "저장 중..." : "저장"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}

    {/* ══ 광고 상세보기 Sheet ═════════════════════════════════════════════ */}
    <Sheet open={!!selectedAd} onOpenChange={(o) => { if (!o) setSelectedAd(null); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {selectedAd && (() => {
          const sc = AD_STATUS[selectedAd.status] ?? AD_STATUS.pending;
          return (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  광고 상세
                </SheetTitle>
              </SheetHeader>

              {/* 이미지 */}
              {selectedAd.imageUrl && (
                <img src={selectedAd.imageUrl} alt="광고 이미지" className="w-full rounded-lg object-cover max-h-56 mb-4" />
              )}

              {/* 상태 뱃지 */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.label}</span>
                {selectedAd.plan && selectedAd.plan !== "basic" && (
                  <span className="text-sm text-muted-foreground">상품 ID: {selectedAd.plan}</span>
                )}
              </div>

              {/* 정보 테이블 */}
              <div className="space-y-3 text-sm mb-6">
                <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">업체명</span><span className="font-semibold">{selectedAd.businessName}</span></div>
                <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">카테고리</span><span>{selectedAd.category}</span></div>
                {selectedAd.title && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">광고 제목</span><span>{selectedAd.title}</span></div>}
                {selectedAd.description && (
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground font-medium">소개글</span>
                    <div className="prose prose-sm max-w-none rounded-md border p-3 bg-muted/30 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedAd.description }} />
                  </div>
                )}
                {selectedAd.contactName && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">담당자</span><span>{selectedAd.contactName}</span></div>}
                {selectedAd.phone && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">연락처</span><a href={`tel:${selectedAd.phone}`} className="text-blue-600">{selectedAd.phone}</a></div>}
                {selectedAd.email && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">이메일</span><a href={`mailto:${selectedAd.email}`} className="text-blue-600">{selectedAd.email}</a></div>}
                {selectedAd.location && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">위치</span><span>{selectedAd.location}</span></div>}
                {selectedAd.date && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">기간</span><span>{selectedAd.date}</span></div>}
                {selectedAd.url && <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">링크</span><a href={selectedAd.url} target="_blank" rel="noreferrer" className="text-blue-600 break-all">{selectedAd.url}</a></div>}
                <div className="flex gap-3"><span className="w-20 shrink-0 text-muted-foreground font-medium">접수일</span><span>{selectedAd.createdAt?.slice(0, 10)}</span></div>
              </div>

              {/* ── SNS 패키지 ─────────────────────────────────────── */}
              {(() => {
                const adId = selectedAd.id;
                const draft = selectedAd.socialDraft;
                const edit = adDraftEdits[adId];
                const caption = edit?.caption ?? cleanCaption(draft?.caption ?? "");
                const hashtagsStr = edit?.hashtagsStr ?? (draft?.hashtags ?? []).map((h: string) => `#${h}`).join(" ");
                const isDirty = !!adDraftEdits[adId];
                return (
                  <div className="border rounded-xl p-4 mb-4 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">② SNS 패키지</p>

                    {/* 사진 슬롯 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">사진</Label>
                      {[
                        { label: "대표", slot: 0, url: selectedAd.imageUrl },
                        { label: "추가 1", slot: 1, url: selectedAd.extraImages?.[0] },
                        { label: "추가 2", slot: 2, url: selectedAd.extraImages?.[1] },
                      ].map(({ label, slot, url }) => (
                        <div key={slot} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-12 shrink-0">{label}</span>
                          {url ? (
                            <div className="relative group flex-1">
                              <img src={url} alt={label} className="w-full h-20 object-cover rounded-lg" />
                              <button
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={async () => {
                                  if (slot === 0) {
                                    await fetch(`${BASE}/api/ads/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ imageUrl: null }) });
                                    setSelectedAd({ ...selectedAd, imageUrl: null });
                                  } else {
                                    const newExtras = (selectedAd.extraImages ?? []).filter((_, i) => i !== slot - 1);
                                    await fetch(`${BASE}/api/ads/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ extraImages: newExtras }) });
                                    setSelectedAd({ ...selectedAd, extraImages: newExtras });
                                  }
                                  qc.invalidateQueries({ queryKey: ["admin-ads"] });
                                }}
                              ><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <label className="flex-1 border-2 border-dashed rounded-lg h-20 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors">
                              <span className="text-xs text-muted-foreground">파일 선택</span>
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const fd = new FormData(); fd.append("image", file);
                                const r = await fetch(`${BASE}/api/ads/${adId}/upload-image?slot=${slot}`, { method: "POST", credentials: "include", body: fd });
                                const j = await r.json() as { success: boolean; imageUrl?: string };
                                if (j.success && j.imageUrl) {
                                  if (slot === 0) setSelectedAd({ ...selectedAd, imageUrl: j.imageUrl });
                                  else {
                                    const extras = [...(selectedAd.extraImages ?? [])];
                                    extras[slot - 1] = j.imageUrl;
                                    setSelectedAd({ ...selectedAd, extraImages: extras });
                                  }
                                  qc.invalidateQueries({ queryKey: ["admin-ads"] });
                                }
                              }} />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 원본 사진 다운로드 */}
                    {[
                      { label: "대표", url: selectedAd.imageUrl },
                      { label: "추가 1", url: selectedAd.extraImages?.[0] },
                      { label: "추가 2", url: selectedAd.extraImages?.[1] },
                    ].filter(({ url }) => !!url).map(({ label, url }, i) => (
                      <button
                        key={i}
                        className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
                        onClick={async () => {
                          const src = url!.startsWith("/api/") ? `${BASE}${url}` : url!;
                          try {
                            const r = await fetch(src, { credentials: "include" });
                            const blob = await r.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = blobUrl;
                            a.download = `photo-${label}.jpg`;
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                          } catch { window.open(src, "_blank"); }
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />{label} 사진 저장
                      </button>
                    ))}

                    {/* ── 카드이미지 생성 ── */}
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">카드이미지 (1080×1080)</p>
                      {adCardUrls[adId] && adCardUrls[adId].length > 0 ? (
                        <div className="space-y-2">
                          {adCardUrls[adId].map((url, i) => (
                            <div key={i} className="space-y-1">
                              <img src={`${BASE}${url}`} alt={`카드이미지 ${i + 1}`} className="w-full rounded-lg border" />
                              <button
                                className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
                                onClick={async () => {
                                  try {
                                    const r = await fetch(`${BASE}${url}`, { credentials: "include" });
                                    const blob = await r.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = blobUrl;
                                    a.download = `card-${adId}-${i + 1}.png`;
                                    a.click();
                                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                                  } catch { window.open(`${BASE}${url}`, "_blank"); }
                                }}
                              >⬇ 카드이미지 {i + 1} 저장</button>
                            </div>
                          ))}
                          <button
                            className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold transition-colors"
                            disabled={adCardLoading[adId]}
                            onClick={async () => {
                              setAdCardLoading((p) => ({ ...p, [adId]: true }));
                              try {
                                const r = await fetch(`${BASE}/api/ads/${adId}/card`, { method: "POST", credentials: "include" });
                                const j = await r.json() as { success: boolean; cardUrls?: string[] };
                                if (j.success && j.cardUrls) setAdCardUrls((p) => ({ ...p, [adId]: j.cardUrls! }));
                              } finally { setAdCardLoading((p) => ({ ...p, [adId]: false })); }
                            }}
                          >{adCardLoading[adId] ? "생성 중..." : "🔄 재생성"}</button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                          disabled={adCardLoading[adId]}
                          onClick={async () => {
                            setAdCardLoading((p) => ({ ...p, [adId]: true }));
                            try {
                              const r = await fetch(`${BASE}/api/ads/${adId}/card`, { method: "POST", credentials: "include" });
                              const j = await r.json() as { success: boolean; cardUrls?: string[] };
                              if (j.success && j.cardUrls) setAdCardUrls((p) => ({ ...p, [adId]: j.cardUrls! }));
                              else toast({ title: "카드이미지 생성 실패", variant: "destructive" });
                            } finally { setAdCardLoading((p) => ({ ...p, [adId]: false })); }
                          }}
                        >{adCardLoading[adId] ? "생성 중..." : "🖼 카드이미지 생성"}</button>
                      )}
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      {!draft && !edit ? (
                        <Button size="sm" className="w-full" onClick={async () => {
                          const r = await fetch(`${BASE}/api/ads/${adId}/draft`, { method: "POST", credentials: "include" });
                          const j = await r.json() as { success: boolean; draft?: SocialDraft };
                          if (j.success && j.draft) {
                            setSelectedAd({ ...selectedAd, socialDraft: j.draft });
                            toast({ title: "SNS 초안 생성 완료" });
                          }
                        }}>
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />SNS 초안 생성
                        </Button>
                      ) : (
                        <>
                          <Label className="text-xs font-semibold text-muted-foreground">SNS 문구</Label>
                          <div className="rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                            <textarea
                              className="w-full text-sm resize-none p-3 outline-none bg-background leading-relaxed min-h-[120px]"
                              value={caption}
                              onChange={(e) => setAdDraftEdits((p) => ({ ...p, [adId]: { caption: e.target.value, hashtagsStr: edit?.hashtagsStr ?? (draft?.hashtags ?? []).map((h: string) => `#${h}`).join(" ") } }))}
                            />
                            <div className="border-t border-input flex">
                              <a
                                href={`${window.location.origin}/content/${adId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 transition-colors"
                              >
                                🔗 자세히 보기
                              </a>
                              <a
                                href="https://playgangneung.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-semibold py-2.5 transition-colors"
                              >
                                🏠 PLAY강릉 바로가기
                              </a>
                            </div>
                          </div>
                          <Label className="text-xs font-semibold text-muted-foreground">해시태그</Label>
                          <Input
                            className="text-sm"
                            value={hashtagsStr}
                            onChange={(e) => setAdDraftEdits((p) => ({ ...p, [adId]: { caption: edit?.caption ?? draft?.caption ?? "", hashtagsStr: e.target.value } }))}
                          />
                          <div className="flex gap-2 flex-wrap">
                            {isDirty && (
                              <Button size="sm" variant="default" className="flex-1" onClick={async () => {
                                const newDraft: SocialDraft = {
                                  title: selectedAd.title,
                                  caption,
                                  hashtags: hashtagsStr.split(/[\s,]+/).filter(Boolean).map((h: string) => h.replace(/^#/, "")),
                                  createdAt: draft?.createdAt ?? new Date().toISOString(),
                                };
                                await fetch(`${BASE}/api/ads/${adId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ socialDraft: newDraft }) });
                                setSelectedAd({ ...selectedAd, socialDraft: newDraft });
                                setAdDraftEdits((p) => { const n = { ...p }; delete n[adId]; return n; });
                                toast({ title: "저장 완료" });
                              }}>저장</Button>
                            )}
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                              const url = `${window.location.origin}/content/${adId}`;
                              navigator.clipboard.writeText(
                                `${caption}\n\n${hashtagsStr}\n\n🔗 자세히 보기 → ${url}\n🏠 PLAY강릉 바로가기 → https://playgangneung.com`
                              ).then(() => { setAdCopied(true); setTimeout(() => setAdCopied(false), 2000); toast({ title: "복사됨" }); });
                            }}>
                              {adCopied ? <Check className="w-3 h-3 mr-1 text-green-600" /> : <Copy className="w-3 h-3 mr-1" />}
                              {adCopied ? "복사됨" : "복사"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={async () => {
                              const r = await fetch(`${BASE}/api/ads/${adId}/draft`, { method: "POST", credentials: "include" });
                              const j = await r.json() as { success: boolean; draft?: SocialDraft };
                              if (j.success && j.draft) {
                                setSelectedAd({ ...selectedAd, socialDraft: j.draft });
                                setAdDraftEdits((p) => { const n = { ...p }; delete n[adId]; return n; });
                                toast({ title: "재생성 완료" });
                              }
                            }}>
                              <RefreshCw className="w-3 h-3 mr-1" />재생성
                            </Button>
                          </div>
                          {/* ── 발행 가이드 ─────────────────────────────── */}
                          <div className="space-y-2 pt-1">
                            {/* 페이스북 */}
                            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1.5">
                              <p className="text-[11px] font-bold text-blue-700">📘 페이스북 — 링크 미리보기로 올리기</p>
                              <p className="text-[11px] text-blue-600">1. 아래 "PLAY강릉 링크 복사" 클릭</p>
                              <p className="text-[11px] text-blue-600">2. 페이스북 게시창에 링크 붙여넣기</p>
                              <p className="text-[11px] text-blue-600">3. 미리보기 카드(사진+제목) 자동 생성 확인</p>
                              <p className="text-[11px] text-blue-600">4. 링크 텍스트 지우고 문구 붙여넣기 → 게시</p>
                              <p className="text-[11px] text-blue-500 italic">→ 독자가 사진 클릭 시 PLAY강릉 페이지로 이동!</p>
                              <div className="flex gap-2 pt-0.5">
                                <button
                                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors"
                                  onClick={() => {
                                    const url = `${window.location.origin}/content/${adId}`;
                                    navigator.clipboard.writeText(url).then(() =>
                                      toast({ title: "PLAY강릉 링크 복사됨", description: "페이스북 게시창에 붙여넣으세요." })
                                    );
                                  }}
                                >🔗 PLAY강릉 링크 복사</button>
                                <a href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR" target="_blank" rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#1877F2] hover:bg-[#1565C0] transition-colors">
                                  페이스북 열기
                                </a>
                              </div>
                            </div>
                            {/* Meta Business Suite */}
                            <div className="rounded-xl bg-[#f0f2ff] border border-[#c7ccf5] px-4 py-3 space-y-1.5">
                              <p className="text-[11px] font-bold text-[#3b5bdb]">🏢 Meta Business Suite — 페북 + 인스타 한 번에</p>
                              <p className="text-[11px] text-[#4c6ef5] font-semibold">✅ 가장 빠른 방법 (PC 권장):</p>
                              <p className="text-[11px] text-[#4c6ef5]">1. 위 "문구 전체 복사" 클릭</p>
                              <p className="text-[11px] text-[#4c6ef5]">2. 아래 버튼 클릭 → 게시물 작성 창 열림</p>
                              <p className="text-[11px] text-[#4c6ef5]">3. 캡션 붙여넣기 + 이미지 첨부 → 페북·인스타 동시 게시</p>
                              <a href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR"
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#3b5bdb] hover:bg-[#2f4ac4] transition-colors mt-1">
                                Meta Business Suite 열기
                              </a>
                            </div>
                            {/* 인스타그램 / 유튜브 */}
                            <div className="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 space-y-1.5">
                              <p className="text-[11px] font-bold text-pink-700">📸 인스타그램 — 앱에서 올리기 (모바일)</p>
                              <p className="text-[11px] text-pink-600">1. 위 "대표 이미지 다운로드" → 갤러리에 보관</p>
                              <p className="text-[11px] text-pink-600">2. "문구 전체 복사" 클릭 (링크 포함)</p>
                              <p className="text-[11px] text-pink-600">3. 인스타 앱 → 새 게시물 → 대표 이미지 선택</p>
                              <p className="text-[11px] text-pink-600">4. 캡션란에 붙여넣기(길게 누르기) → 게시</p>
                              <div className="flex gap-2 pt-0.5">
                                <a href="https://www.instagram.com/playgangneung/" target="_blank" rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#E1306C] hover:bg-[#C2185B] transition-colors">
                                  인스타그램 열기
                                </a>
                                <a href="https://www.youtube.com/@playgangneung" target="_blank" rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#FF0000] hover:bg-[#CC0000] transition-colors">
                                  유튜브 열기
                                </a>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 액션 버튼 */}
              <div className="space-y-2">
                {selectedAd.status === "pending" && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={adStatusMutation.isPending}
                    onClick={() => { adStatusMutation.mutate({ id: selectedAd.id, status: "approved" }); setSelectedAd({ ...selectedAd, status: "approved" }); }}>
                    <CheckCircle className="w-4 h-4 mr-2" />승인
                  </Button>
                )}
                {selectedAd.status === "approved" && (
                  <Button className="w-full" variant="outline" disabled={adStatusMutation.isPending}
                    onClick={() => { adStatusMutation.mutate({ id: selectedAd.id, status: "scheduled" }); setSelectedAd({ ...selectedAd, status: "scheduled" }); }}>
                    발행예정으로 변경
                  </Button>
                )}
                {selectedAd.status === "scheduled" && (
                  <Button className="w-full" variant="outline" disabled={adStatusMutation.isPending}
                    onClick={() => { adStatusMutation.mutate({ id: selectedAd.id, status: "published" }); setSelectedAd({ ...selectedAd, status: "published" }); }}>
                    발행완료로 변경
                  </Button>
                )}
                {!["rejected", "published"].includes(selectedAd.status) && (
                  <Button className="w-full" variant="outline" disabled={adStatusMutation.isPending}
                    onClick={() => { adStatusMutation.mutate({ id: selectedAd.id, status: "rejected" }); setSelectedAd({ ...selectedAd, status: "rejected" }); }}>
                    <XCircle className="w-4 h-4 mr-2 text-red-500" />제외
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={reportLinkLoading === selectedAd.id}
                  onClick={() => handleCopyReportLink(selectedAd.id)}
                >
                  {reportLinkLoading === selectedAd.id ? (
                    <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />링크 생성 중...</>
                  ) : (
                    <><Copy className="w-3 h-3 mr-1 text-blue-500" />광고주 리포트 링크 복사</>
                  )}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={resetReportLoading === selectedAd.id}
                  onClick={() => handleResetReportToken(selectedAd.id)}
                >
                  {resetReportLoading === selectedAd.id ? (
                    <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />재발급 중...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3 mr-1 text-orange-500" />리포트 링크 재발급</>
                  )}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={sendReportLoading === selectedAd.id}
                  onClick={() => handleSendReport(selectedAd)}
                >
                  {sendReportLoading === selectedAd.id ? (
                    <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />발송 중...</>
                  ) : (
                    <><Send className="w-3 h-3 mr-1 text-green-600" />리포트 링크 이메일 발송</>
                  )}
                </Button>
                {selectedAd.reportSentAt && (
                  <p className="text-xs text-gray-500 text-center -mt-1">
                    마지막 발송: {new Date(selectedAd.reportSentAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" variant="outline" onClick={() => { setEditingAd(selectedAd); setSelectedAd(null); }}>
                    <Pencil className="w-3 h-3 mr-1" />수정
                  </Button>
                  <Button className="flex-1" variant="outline" disabled={adDeleteMutation.isPending}
                    onClick={() => { adDeleteMutation.mutate(selectedAd.id); setSelectedAd(null); }}>
                    <Trash2 className="w-3 h-3 mr-1 text-red-500" />삭제
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>

    {/* ══ 광고 수정 다이얼로그 ══════════════════════════════════════════════ */}
    {editingAd && (
      <Dialog open onOpenChange={(o) => { if (!o) setEditingAd(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-600" />광고 수정</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            adEditMutation.mutate({ id: editingAd.id, patch: {
              title: fd.get("title") as string, businessName: fd.get("businessName") as string,
              contactName: fd.get("contactName") as string, phone: fd.get("phone") as string,
              email: fd.get("email") as string, category: fd.get("category") as string,
              description: fd.get("description") as string, date: fd.get("date") as string,
              location: fd.get("location") as string, url: fd.get("url") as string,
              plan: fd.get("plan") as Ad["plan"],
            }});
          }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>광고 제목</Label><Input name="title" defaultValue={editingAd.title} required /></div>
              <div className="space-y-1"><Label>업체명</Label><Input name="businessName" defaultValue={editingAd.businessName} required /></div>
              <div className="space-y-1"><Label>카테고리</Label><Input name="category" defaultValue={editingAd.category} /></div>
              <div className="space-y-1"><Label>담당자</Label><Input name="contactName" defaultValue={editingAd.contactName} /></div>
              <div className="space-y-1"><Label>연락처</Label><Input name="phone" defaultValue={editingAd.phone} /></div>
              <div className="col-span-2 space-y-1"><Label>이메일</Label><Input name="email" type="email" defaultValue={editingAd.email} /></div>
              <div className="col-span-2 space-y-1"><Label>광고 내용</Label><Textarea name="description" rows={3} defaultValue={editingAd.description} /></div>
              <div className="space-y-1"><Label>날짜</Label><Input name="date" type="date" defaultValue={editingAd.date} /></div>
              <div className="space-y-1"><Label>위치</Label><Input name="location" defaultValue={editingAd.location} /></div>
              <div className="col-span-2 space-y-1"><Label>링크 URL</Label><Input name="url" defaultValue={editingAd.url} placeholder="https://" /></div>
              <div className="col-span-2 space-y-1"><Label>광고 플랜</Label>
                <select name="plan" defaultValue={editingAd.plan} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="basic">기본 (1일 노출)</option>
                  <option value="main">메인 (3일 노출, 상단 고정)</option>
                  <option value="premium">프리미엄 (5일 노출, 최상단)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingAd(null)}>취소</Button>
              <Button type="submit" disabled={adEditMutation.isPending}>{adEditMutation.isPending ? "저장 중..." : "저장"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}
    {/* ══ 수동 피드 등록 다이얼로그 ══════════════════════════════════════════ */}
    <Dialog open={showManualDialog} onOpenChange={(o) => { if (!o) resetManualDialog(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-green-600" />새 피드 등록
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            manualMutation.mutate({
              title: manualForm.title,
              description: manualForm.description,
              category: manualForm.category,
              link: manualForm.link || undefined,
              startDate: manualForm.startDate || undefined,
              endDate: manualForm.endDate || undefined,
              location: manualForm.location || undefined,
              contact: manualForm.contact || undefined,
              source: manualForm.source || undefined,
              thumbnail: manualThumbnail || null,
              videoUrl: manualForm.videoUrl || null,
            });
          }}
        >
          {/* URL 자동추출 */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-700">URL로 자동 추출</p>
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://... 링크를 붙여넣으세요"
                className="text-sm bg-white"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleExtractUrl(); } }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleExtractUrl}
                disabled={isExtracting || !urlInput.trim()}
                className="shrink-0 bg-blue-600 hover:bg-blue-700"
              >
                {isExtracting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "추출"}
              </Button>
            </div>
            <p className="text-[11px] text-blue-500">제목·설명·이미지·날짜를 자동으로 가져옵니다. 이후 직접 수정 가능합니다.</p>
          </div>

          <div className="space-y-1">
            <Label>제목 <span className="text-red-500">*</span></Label>
            <Input
              required
              value={manualForm.title}
              onChange={(e) => setManualForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="예: 2026 강릉커피축제 개막"
            />
          </div>
          <div className="space-y-1">
            <Label>내용 설명</Label>
            <Textarea
              rows={6}
              value={manualForm.description}
              onChange={(e) => setManualForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="행사·장소·정보 등 간단히 설명해 주세요."
            />
          </div>
          <div className="space-y-1">
            <Label>원본 링크</Label>
            <Input
              type="url"
              value={manualForm.link}
              onChange={(e) => setManualForm((p) => ({ ...p, link: e.target.value }))}
              placeholder="https://example.com/article"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>카테고리</Label>
              <select
                value={manualForm.category}
                onChange={(e) => setManualForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="행사">행사</option>
                <option value="맛집">맛집</option>
                <option value="핫플">핫플</option>
                <option value="지역소식">지역소식</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>출처 / 업체명</Label>
              <Input
                value={manualForm.source}
                onChange={(e) => setManualForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="예: 강릉시청"
              />
            </div>
            <div className="space-y-1">
              <Label>시작일</Label>
              <Input
                type="date"
                value={manualForm.startDate}
                onChange={(e) => setManualForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>종료일</Label>
              <Input
                type="date"
                value={manualForm.endDate}
                onChange={(e) => setManualForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>장소/주소</Label>
              <Input
                value={manualForm.location}
                onChange={(e) => setManualForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="예: 강릉시 남대천 행사장 일대 / 강원특별자치도 강릉시 ○○로 ○○"
              />
            </div>
            <div className="space-y-1">
              <Label>문의처</Label>
              <Input
                value={manualForm.contact}
                onChange={(e) => setManualForm((p) => ({ ...p, contact: e.target.value }))}
                placeholder="예: 033-000-0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>대표 이미지 URL</Label>
            <Input
              value={manualThumbnail}
              onChange={(e) => setManualThumbnail(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            {manualThumbnail && (
              <div className="rounded-lg overflow-hidden border h-32 bg-gray-50">
                <img key={manualThumbnail} src={proxyAdminImg(manualThumbnail)} alt="" className="w-full h-full object-cover"
                  onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) { img.src = manualThumbnail; } else { img.style.display = "none"; } }} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>동영상 URL</Label>
            <Input
              value={manualForm.videoUrl}
              onChange={(e) => setManualForm((p) => ({ ...p, videoUrl: e.target.value }))}
              placeholder="https://youtu.be/... 또는 MP4 직접 URL"
            />
            <p className="text-xs text-muted-foreground">유튜브·쇼츠는 자동 임베드 / MP4는 플레이어로 표시됩니다.</p>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={resetManualDialog}>취소</Button>
            <Button type="submit" disabled={manualMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {manualMutation.isPending ? "등록 중..." : "등록하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

          {/* ── 모바일 미리보기 오버레이 ── */}
    {showMobilePreview && (
      <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-3">
          {/* 닫기 + 경로 선택 툴바 */}
          <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2 shadow-xl">
            <Smartphone className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700 mr-1">모바일 미리보기</span>
            <button
              onClick={() => setMobilePreviewPath("/")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mobilePreviewPath === "/" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >홈</button>
            <button
              onClick={() => setMobilePreviewPath("/admin")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mobilePreviewPath === "/admin" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            >관리자</button>
            <button
              onClick={() => setShowMobilePreview(false)}
              className="ml-2 p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 폰 프레임 */}
          <div className="relative bg-gray-900 rounded-[46px] p-3 shadow-2xl" style={{ width: 536, height: 988 }}>
            {/* 노치 */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-gray-900 rounded-full z-10" />
            {/* 화면 */}
            <div className="w-full h-full bg-white rounded-[38px] overflow-hidden">
              <iframe
                key={mobilePreviewPath}
                src={`${BASE}${mobilePreviewPath}`}
                className="border-none block"
                title="모바일 미리보기"
                style={{ width: "390px", height: "calc(100% / 1.31)", transform: "scale(1.31)", transformOrigin: "top left" }}
              />
            </div>
          </div>
          <p className="text-white/50 text-xs">390 × 844 (iPhone 14 · 130%)</p>
        </div>
      </div>
    )}
    {/* ══ TOP5 이미지 변경 다이얼로그 ══════════════════════════════════════ */}
    {top5ThumbEdit && (
      <Dialog open onOpenChange={(o) => { if (!o) { setTop5ThumbEdit(null); setTop5ThumbInput(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              대표 이미지 변경
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground line-clamp-1">{top5ThumbEdit.title}</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이미지 URL 입력</label>
              <Input
                value={top5ThumbInput}
                onChange={(e) => setTop5ThumbInput(e.target.value)}
                placeholder="https://... 또는 /api/uploads/..."
              />
            </div>
            <div className="relative">
              <label className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-2.5 cursor-pointer hover:border-blue-400 transition-colors text-sm text-gray-600">
                <Upload className="w-4 h-4" />
                파일 직접 업로드
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("image", file);
                  const r = await fetch(`${BASE}/api/upload-image`, { method: "POST", credentials: "include", body: fd });
                  if (r.ok) { const j = await r.json() as { url: string }; setTop5ThumbInput(j.url); }
                  else { toast({ title: "업로드 실패", variant: "destructive" }); }
                }} />
              </label>
            </div>
            {top5ThumbInput && (
              <div className="rounded-lg overflow-hidden border h-32 bg-gray-50">
                <img key={top5ThumbInput} src={proxyAdminImg(top5ThumbInput)} alt="" className="w-full h-full object-cover"
                  onError={(e) => { const img = e.currentTarget; if (img.src.includes("/api/proxy/image")) img.src = top5ThumbInput; else img.style.display = "none"; }} />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={top5ThumbSaving}
                onClick={async () => {
                  setTop5ThumbSaving(true);
                  try {
                    const r = await fetch(`${BASE}/api/events/${top5ThumbEdit.eventId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ thumbnail: top5ThumbInput || null }),
                    });
                    if (!r.ok) throw new Error("저장 실패");
                    setTop5Draft((prev) => prev.map((d) => d.eventId === top5ThumbEdit.eventId ? { ...d, thumbnail: top5ThumbInput || null } : d));
                    toast({ title: "✅ 이미지 저장 완료", description: "TOP 5 카드에 바로 반영됩니다." });
                    setTop5ThumbEdit(null);
                    setTop5ThumbInput("");
                  } catch {
                    toast({ title: "저장 실패", variant: "destructive" });
                  } finally {
                    setTop5ThumbSaving(false);
                  }
                }}
              >
                {top5ThumbSaving ? "저장 중..." : "💾 저장"}
              </Button>
              <Button variant="outline" onClick={() => { setTop5ThumbEdit(null); setTop5ThumbInput(""); }}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
