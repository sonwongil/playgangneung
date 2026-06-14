import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Star, Pin, Megaphone, ChevronRight, CheckCircle2, LogIn, LogOut } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Top5Item {
  rank: number;
  eventId: string;
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  category: string;
  location: string;
  date: string;
  startDate: string;
  endDate: string;
  scheduleStatus: string;
  link: string;
  source: string;
}

interface FeedItem {
  id: string;
  title: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
  scheduleStatus: string;
  link: string;
  source: string;
  category: string;
  thumbnail: string | null;
  isAd: boolean;
  location?: string;
  hashtags?: string[];
}

interface PremiumAd {
  id: string;
  businessName: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  extraImages?: string[];
  plan: "basic" | "main" | "premium";
  status: string;
  location: string;
  url: string;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = ["전체", "행사", "맛집", "관광", "지역소식", "기타"] as const;
type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

const CATEGORY_COLORS: Record<string, string> = {
  행사:     "bg-blue-100 text-blue-700",
  행사안내: "bg-blue-100 text-blue-700",
  맛집:     "bg-orange-100 text-orange-700",
  카페:     "bg-orange-100 text-orange-700",
  핫플:     "bg-pink-100 text-pink-700",
  관광:     "bg-cyan-100 text-cyan-700",
  지역소식: "bg-green-100 text-green-700",
  강릉소식: "bg-green-100 text-green-700",
};

const RANK_COLORS = [
  "bg-yellow-400 text-yellow-900",
  "bg-gray-300 text-gray-700",
  "bg-amber-600 text-white",
  "bg-gray-200 text-gray-600",
  "bg-gray-200 text-gray-600",
];

const AD_PLAN_BADGE: Record<"basic" | "main" | "premium", { label: string; icon: React.ReactNode; cls: string }> = {
  premium: { label: "프리미엄", icon: <Star className="w-2.5 h-2.5" />,    cls: "bg-amber-100 text-amber-700" },
  main:    { label: "추천광고", icon: <Pin className="w-2.5 h-2.5" />,      cls: "bg-blue-100 text-blue-700" },
  basic:   { label: "광고",     icon: <Megaphone className="w-2.5 h-2.5" />, cls: "bg-gray-100 text-gray-600" },
};

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function proxyImg(url: string): string {
  if (!url) return "";
  if (url.startsWith("/")) return `${BASE}${url}`;
  return `${BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600";
}

function mapToFilterCategory(cat: string): CategoryOption {
  if (["행사", "행사안내"].includes(cat)) return "행사";
  if (["맛집", "카페"].includes(cat)) return "맛집";
  if (["핫플", "관광", "체험"].includes(cat)) return "관광";
  if (["지역소식", "강릉소식", "정보"].includes(cat)) return "지역소식";
  return "기타";
}

// ─── 스켈레톤 ──────────────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div className="shrink-0 w-48">
      <Skeleton className="h-32 w-full rounded-xl mb-2" />
      <Skeleton className="h-3.5 w-4/5 rounded mb-1.5" />
      <Skeleton className="h-3 w-3/5 rounded" />
    </div>
  );
}

function BusinessCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm">
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3.5 w-3/5 rounded-full" />
        <Skeleton className="h-3 w-4/5 rounded-full" />
        <Skeleton className="h-3 w-2/5 rounded-full" />
      </div>
    </div>
  );
}

function FeedCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm">
      <Skeleton className="w-full aspect-[4/3]" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-3.5 w-4/5 rounded-full" />
        <Skeleton className="h-3 w-3/5 rounded-full" />
        <Skeleton className="h-3 w-2/5 rounded-full" />
      </div>
    </div>
  );
}

// ─── 오늘의 강릉소식 카드 ──────────────────────────────────────────────────

function TodayNewsCard({ item }: { item: Top5Item }) {
  const rankColor = RANK_COLORS[item.rank - 1] ?? RANK_COLORS[4];
  const href = `${BASE}/content/${item.eventId}`;

  function handleClick() {
    sessionStorage.setItem("playgangneung_return_url", window.location.pathname);
    window.location.href = href;
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${item.title} 보기`}
      draggable={false}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); }
      }}
      className="shrink-0 w-48 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 rounded-xl"
    >
      <div className="relative h-32 rounded-xl overflow-hidden bg-gray-200 mb-2">
        {item.thumbnail ? (
          <img
            src={proxyImg(item.thumbnail)}
            alt={item.title}
            draggable={false}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/api/proxy/image")) { img.src = item.thumbnail!; }
              else { img.src = `${BASE}/logo.png`; img.className = "w-full h-full object-contain p-4"; }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
            <span className="text-3xl">🏖️</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold shadow ${rankColor}`}>
            {item.rank}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <p className="text-[12px] font-semibold text-gray-800 line-clamp-2 leading-snug mb-1">
        {item.title}
      </p>
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColor(item.category)}`}>
          {item.category}
        </span>
        <span className="text-[10px] text-gray-400 truncate">{item.source}</span>
      </div>
    </div>
  );
}

// ─── 소상공인 추천 카드 ────────────────────────────────────────────────────

function BusinessCard({ ad }: { ad: PremiumAd }) {
  const badge  = AD_PLAN_BADGE[ad.plan] ?? AD_PLAN_BADGE.basic;
  const imgSrc = ad.imageUrl ?? ad.extraImages?.[0] ?? null;
  const href   = `${BASE}/content/${ad.id}`;

  function handleClick() {
    sessionStorage.setItem("playgangneung_return_url", window.location.pathname);
    window.location.href = href;
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${ad.businessName} 자세히 보기`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); }
      }}
      className="rounded-2xl overflow-hidden bg-white shadow-sm cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      {/* 이미지 */}
      <div className="w-full aspect-[4/3] bg-gray-100 overflow-hidden relative">
        {imgSrc ? (
          <img
            src={proxyImg(imgSrc)}
            alt={ad.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/api/proxy/image")) { img.src = imgSrc; }
              else { img.style.display = "none"; }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
            <span className="text-4xl opacity-40">🏪</span>
          </div>
        )}
        {/* 플랜 배지 — 이미지 우상단 */}
        <span className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${badge.cls}`}>
          {badge.icon}{badge.label}
        </span>
      </div>

      {/* 텍스트 */}
      <div className="p-3">
        <p className="text-sm font-extrabold text-gray-900 line-clamp-1 mb-0.5">
          {ad.businessName || ad.title}
        </p>
        <p className="text-xs text-gray-500 line-clamp-2 leading-snug mb-2">
          {ad.title !== ad.businessName ? ad.title : ad.description}
        </p>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColor(ad.category)}`}>
            {ad.category}
          </span>
          {ad.location && (
            <span className="text-[10px] text-gray-400 truncate">{ad.location}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 강릉노트 피드 카드 ────────────────────────────────────────────────────

function FeedCard({ item }: { item: FeedItem }) {
  const href = `${BASE}/content/${item.id}`;

  function handleClick() {
    sessionStorage.setItem("playgangneung_return_url", window.location.pathname);
    window.location.href = href;
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`${item.title} 보기`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); }
      }}
      className="rounded-2xl overflow-hidden bg-white shadow-sm cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <div className="w-full aspect-[4/3] bg-gray-100 overflow-hidden">
        {item.thumbnail ? (
          <img
            src={proxyImg(item.thumbnail)}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/api/proxy/image")) { img.src = item.thumbnail!; }
              else { img.style.display = "none"; }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-3xl opacity-30">📝</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-1">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-gray-400 line-clamp-1 mb-2">{item.description}</p>
        )}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColor(item.category)}`}>
            {item.category}
          </span>
          <span className="text-[10px] text-gray-400 truncate">{item.source}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export default function HomeV2Page() {
  const { signOut }   = useClerk();
  const { isSignedIn } = useUser();

  const [search, setSearch]            = useState("");
  const [activeCategory, setCategory] = useState<CategoryOption>("전체");
  const [showAll, setShowAll]          = useState(false);
  const [adClicked, setAdClicked]      = useState(false);
  const carouselRef                    = useRef<HTMLDivElement>(null);
  const dragRef                        = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const adTimerRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // bfcache 방지
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // ── 오늘의 강릉소식 (TOP5) ──
  const { data: top5Data, isLoading: top5Loading } = useQuery<{ date: string; items: Top5Item[] }>({
    queryKey: ["homev2-top5"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/top5`);
      if (!res.ok) throw new Error("TOP5 로드 실패");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // ── 소상공인 추천 ──
  const { data: adsData, isLoading: adsLoading } = useQuery<{ ads: PremiumAd[] }>({
    queryKey: ["homev2-premium-ads"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ads/premium-featured`);
      if (!res.ok) throw new Error("추천 광고 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // ── 강릉노트 피드 ──
  const { data: feedData, isLoading: feedLoading } = useQuery<{ feed: FeedItem[]; total: number }>({
    queryKey: ["homev2-feed"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/feed`);
      if (!res.ok) throw new Error("피드 로드 실패");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // ── 피드 필터링 ──
  const filteredFeed = useMemo(() => {
    const allFeed = (feedData?.feed ?? []).filter((e) => !e.isAd);
    const q = search.trim().toLowerCase();
    return allFeed.filter((item) => {
      const matchSearch = !q || [item.title, item.description, item.category, item.source]
        .join(" ").toLowerCase().includes(q);
      const mappedCat = mapToFilterCategory(item.category);
      const matchCategory = activeCategory === "전체" || mappedCat === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [feedData, search, activeCategory]);

  const top5Items  = top5Data?.items ?? [];
  const premiumAds = (adsData?.ads ?? []).slice(0, 6);
  const display    = showAll ? filteredFeed : filteredFeed.slice(0, 12);
  const isFiltered = search.trim() !== "" || activeCategory !== "전체";

  // ── 캐러셀 드래그 (마우스) ──
  function onCarouselMouseDown(e: React.MouseEvent) {
    const el = carouselRef.current;
    if (!el) return;
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragRef.current.startX;
      if (!dragRef.current.moved && Math.abs(dx) > 5) dragRef.current.moved = true;
      if (dragRef.current.moved && carouselRef.current)
        carouselRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
    };
    const onUp = () => {
      dragRef.current.active = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function resetFilter() { setSearch(""); setCategory("전체"); setShowAll(false); }

  const handleAdInquiry = useCallback(() => {
    setAdClicked(true);
    if (adTimerRef.current) clearTimeout(adTimerRef.current);
    adTimerRef.current = setTimeout(() => setAdClicked(false), 3500);
  }, []);

  useEffect(() => () => { if (adTimerRef.current) clearTimeout(adTimerRef.current); }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">

        {/* ── PC 헤더: 한 줄 (sm 이상) ── */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-4 items-center gap-3" style={{ height: 56 }}>
          {/* 로고: 왼쪽 고정 */}
          <a href={`${BASE}/`} className="shrink-0" aria-label="PLAY강릉 홈">
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 40, width: "auto" }} />
          </a>
          {/* 검색창: flex-1 래퍼 안에서 mx-auto 중앙 배치 */}
          <div className="flex-1 flex items-center">
          <div className="w-full max-w-xl mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
              placeholder="행사, 맛집, 핫플, 지역소식..."
              className="w-full pl-9 pr-8 h-10 rounded-full bg-gray-100 border-0 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-orange-400"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setShowAll(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="검색 초기화"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          </div>
          {/* 버튼: 오른쪽 고정, 내용 크기만큼만 차지 */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isSignedIn ? (
              <>
                <Link href="/ad-submit" className="inline-flex items-center min-h-[44px] px-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors whitespace-nowrap">광고접수</Link>
                <button onClick={() => signOut()} aria-label="로그아웃" className="inline-flex items-center justify-center min-h-[44px] w-11 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><LogOut className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <Link href="/sign-in" aria-label="로그인" className="inline-flex items-center justify-center min-h-[44px] w-11 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><LogIn className="w-4 h-4" /></Link>
                <Link href="/ad-submit" className="inline-flex items-center min-h-[44px] px-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors whitespace-nowrap">광고접수</Link>
              </>
            )}
          </div>
        </div>

        {/* ── 모바일 헤더: 2행 (sm 미만) ── */}
        <div className="sm:hidden">
          {/* 행1: 로고 + 버튼 */}
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: 52 }}>
            <a href={`${BASE}/`} className="shrink-0" aria-label="PLAY강릉 홈">
              <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 34, width: "auto" }} />
            </a>
            <div className="shrink-0 flex items-center gap-1.5">
              {isSignedIn ? (
                <>
                  <Link href="/ad-submit" className="inline-flex items-center min-h-[44px] px-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors whitespace-nowrap">광고접수</Link>
                  <button onClick={() => signOut()} aria-label="로그아웃" className="inline-flex items-center justify-center min-h-[44px] w-11 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><LogOut className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <Link href="/sign-in" aria-label="로그인" className="inline-flex items-center justify-center min-h-[44px] w-11 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"><LogIn className="w-4 h-4" /></Link>
                  <Link href="/ad-submit" className="inline-flex items-center min-h-[44px] px-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors whitespace-nowrap">광고접수</Link>
                </>
              )}
            </div>
          </div>
          {/* 행2: 검색창 전체 폭 */}
          <div className="max-w-6xl mx-auto px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
                placeholder="행사, 맛집, 핫플, 지역소식..."
                className="w-full pl-9 pr-8 h-10 rounded-full bg-gray-100 border-0 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-orange-400"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setShowAll(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="검색 초기화"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 카테고리 탭 바 (공통) */}
        <div
          className="max-w-6xl mx-auto px-4 pb-2 pt-1 flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setShowAll(false); }}
              className={`shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-4 pb-8">

        {/* 히어로 문구 */}
        {!isFiltered && (
          <p className="text-xs text-gray-400 mb-4">
            강릉의 오늘을 한눈에 보는 로컬 소식 플랫폼
          </p>
        )}

        {/* ══ 1. 오늘의 강릉소식 ══ */}
        {!isFiltered && (
          <section className="mb-6">
            <h2 className="flex items-center gap-1.5 mb-3">
              <span className="text-base leading-none">📌</span>
              <span className="text-sm font-extrabold text-gray-900">오늘의 강릉소식</span>
            </h2>

            {top5Loading ? (
              <div className="flex gap-3 overflow-x-hidden pb-1 -mx-4 px-4">
                {Array.from({ length: 5 }).map((_, i) => <NewsCardSkeleton key={i} />)}
              </div>
            ) : top5Items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-400">
                오늘의 강릉소식이 아직 준비되지 않았습니다.
              </div>
            ) : (
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 cursor-grab active:cursor-grabbing"
                style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", touchAction: "pan-x" } as React.CSSProperties}
                onMouseDown={onCarouselMouseDown}
                onClick={(e) => { if (dragRef.current.moved) e.stopPropagation(); }}
                onDragStart={(e) => e.preventDefault()}
              >
                {top5Items.map((item) => (
                  <TodayNewsCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══ 2. 소상공인 추천 ══ 데이터 없으면 제목 포함 전체 숨김 */}
        {!isFiltered && (adsLoading || premiumAds.length > 0) && (
          <section className="mb-6">
            <h2 className="flex items-center gap-1.5 mb-3">
              <span className="text-base leading-none">🏪</span>
              <span className="text-sm font-extrabold text-gray-900">강릉시 소상공인추천</span>
              <span className="text-[10px] text-gray-400 font-normal ml-1">강릉 지역 업체</span>
            </h2>

            {adsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => <BusinessCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {premiumAds.map((ad) => (
                  <BusinessCard key={ad.id} ad={ad} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══ 광고문의 배너 ══ */}
        {!isFiltered && (
          <section className="mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-5 py-5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                강릉 소상공인을 위한
              </p>
              <h3 className="text-base font-extrabold text-white leading-snug mb-2">
                온라인 홍보가 필요하신가요?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                PLAY강릉은 지역 소식, 강릉노트, 소상공인 추천 카드, SNS 광고를 연결해
                작은 가게도 쉽게 온라인 홍보를 시작할 수 있도록 돕습니다.
              </p>

              {adClicked ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm text-white">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>광고 문의 기능을 준비 중입니다. 곧 만나보실 수 있어요!</span>
                </div>
              ) : (
                <button
                  onClick={handleAdInquiry}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition-colors text-white font-bold text-sm"
                >
                  광고 문의하기
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── 검색 결과 카운트 ── */}
        {isFiltered && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              {filteredFeed.length}건
              {search && (
                <span className="ml-1 font-medium text-orange-600">· &quot;{search}&quot;</span>
              )}
              {activeCategory !== "전체" && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">{activeCategory}</Badge>
              )}
            </p>
            <button
              onClick={resetFilter}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              초기화
            </button>
          </div>
        )}

        {/* ══ 3. 강릉노트 ══ */}
        <section>
          {!isFiltered && (
            <h2 className="flex items-center gap-1.5 mb-3">
              <span className="text-base leading-none">📝</span>
              <span className="text-sm font-extrabold text-gray-900">강릉노트</span>
            </h2>
          )}

          {feedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <FeedCardSkeleton key={i} />)}
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">
                {isFiltered ? "검색 결과가 없습니다." : "강릉의 새로운 소식을 준비하고 있습니다."}
              </p>
              {!isFiltered && (
                <p className="text-xs text-gray-400 mt-1">곧 더 많은 강릉노트가 업데이트됩니다.</p>
              )}
              {isFiltered && (
                <Button variant="outline" size="sm" className="mt-4 text-xs min-h-[44px]" onClick={resetFilter}>
                  전체 보기
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {display.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
              {!showAll && filteredFeed.length > 12 && (
                <div className="mt-6 text-center">
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-[44px] text-sm"
                    onClick={() => setShowAll(true)}
                  >
                    더 보기 ({filteredFeed.length - 12}건)
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── 공식 사업자 푸터 ── */}
        <footer className="mt-10 pt-6 border-t border-gray-100 text-center space-y-0.5">
          <p className="text-xs font-semibold text-gray-500">PLAY강릉</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            상호: 플레이강릉 | 대표: 손원길 | 사업자등록번호: 292-07-03357
          </p>
          <p className="text-[11px] text-gray-400">
            주소: 강원특별자치도 강릉시 사천면 진리해변길 37 103-1101
          </p>
          <p className="text-[11px] text-gray-400">
            업태: 정보통신업 | 종목: 뉴스 제공업
          </p>
          <p className="text-[11px] text-gray-400 pt-0.5">
            문의:{" "}
            <a href="mailto:event62@gmail.com" className="hover:text-gray-600 underline transition-colors">
              event62@gmail.com
            </a>
          </p>
          <p className="text-[10px] text-gray-300 pt-1">© 2026 PLAY강릉</p>
        </footer>
      </main>
    </div>
  );
}
