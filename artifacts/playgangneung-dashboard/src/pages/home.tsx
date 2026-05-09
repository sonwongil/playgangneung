import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays, ExternalLink, MapPin, Instagram, Facebook, Youtube,
  Megaphone, Star, Pin, Search, X,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type QuickFilter = "오늘" | "이번 주" | "주말" | "무료" | "가족" | "공연·전시";

const DATE_FILTERS = new Set<QuickFilter>(["오늘", "이번 주", "주말"]);

const QUICK_FILTER_KEYWORDS: Partial<Record<QuickFilter, string[]>> = {
  무료: ["무료"],
  가족: ["가족"],
  "공연·전시": ["공연", "전시"],
};

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
  adPlan?: "basic" | "main" | "premium";
  adWeight?: number;
  businessName?: string;
  location?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  행사: "bg-blue-100 text-blue-700",
  맛집: "bg-orange-100 text-orange-700",
  핫플: "bg-pink-100 text-pink-700",
  지역소식: "bg-green-100 text-green-700",
};

const AD_PLAN_CONFIG = {
  premium: {
    label: "프리미엄 광고",
    icon: <Star className="w-3 h-3" />,
    ring: "ring-2 ring-amber-400",
    banner: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    badge: "bg-amber-100 text-amber-700",
  },
  main: {
    label: "메인 광고",
    icon: <Pin className="w-3 h-3" />,
    ring: "ring-2 ring-blue-400",
    banner: "bg-gradient-to-r from-blue-600 to-blue-500 text-white",
    badge: "bg-blue-100 text-blue-700",
  },
  basic: {
    label: "광고",
    icon: <Megaphone className="w-3 h-3" />,
    ring: "",
    banner: "",
    badge: "bg-gray-100 text-gray-600",
  },
};

function getRelativeDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const TODAY_STR = getRelativeDate(0);

const FALLBACK_FEED: FeedItem[] = [];

const CATEGORY_FALLBACK_POOL: Record<string, string[]> = {
  행사: [
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
  ],
  맛집: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
    "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=800&q=80",
  ],
  핫플: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
  ],
  지역소식: [
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
    "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?w=800&q=80",
  ],
};

function pickFallbackImage(id: string, category: string): string {
  const pool = CATEGORY_FALLBACK_POOL[category] ?? CATEGORY_FALLBACK_POOL["행사"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function getWeekRange() {
  const d = new Date();
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
}

function AdBadge({ plan }: { plan: "basic" | "main" | "premium" }) {
  const cfg = AD_PLAN_CONFIG[plan];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const category = item.category ?? "지역소식";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  const thumbnail = item.thumbnail ?? pickFallbackImage(item.id, category);
  const adCfg = item.isAd && item.adPlan ? AD_PLAN_CONFIG[item.adPlan] : null;
  const isToday = item.date === TODAY_STR;

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${adCfg?.ring ?? ""}`}>
      {adCfg && (item.adPlan === "premium" || item.adPlan === "main") && (
        <div className={`${adCfg.banner} flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold`}>
          {adCfg.icon}
          <span>{adCfg.label}</span>
          <span className="ml-auto opacity-80 text-[10px]">{item.businessName}</span>
        </div>
      )}
      <div className="relative overflow-hidden h-48">
        <img
          src={thumbnail}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {item.isAd && item.adPlan ? (
            <AdBadge plan={item.adPlan} />
          ) : (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
              {category}
            </span>
          )}
          {isToday && !item.isAd && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
              오늘
            </span>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-base leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{item.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{item.location || item.source}</span>
          </div>
        </div>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            {item.isAd ? "업체 정보 보기" : "자세히 보기"} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "오늘", label: "🗓️ 오늘" },
  { key: "이번 주", label: "📅 이번 주" },
  { key: "주말", label: "🌅 주말" },
  { key: "무료", label: "🎉 무료" },
  { key: "가족", label: "👨‍👩‍👧 가족" },
  { key: "공연·전시", label: "🎭 공연·전시" },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const weekRange = useMemo(() => getWeekRange(), []);

  const { data } = useQuery<{ feed: FeedItem[]; total: number }>({
    queryKey: ["public-feed"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/feed`);
      if (!res.ok) throw new Error("피드 로드 실패");
      return res.json();
    },
    staleTime: 30_000,
  });

  const allItems: FeedItem[] = data?.feed?.length ? data.feed : FALLBACK_FEED;

  const filtered = useMemo(() => {
    let items = [...allItems];

    // Date-based quick filters (only non-ad items)
    if (activeFilter === "오늘") {
      items = items.filter((i) => i.isAd || i.date === TODAY_STR);
    } else if (activeFilter === "이번 주") {
      items = items.filter((i) => i.isAd || (i.date >= weekRange.start && i.date <= weekRange.end));
    } else if (activeFilter === "주말") {
      items = items.filter((i) => i.isAd || isWeekend(i.date));
    }

    // Keyword-based quick filter
    const kwFilter = activeFilter && !DATE_FILTERS.has(activeFilter)
      ? QUICK_FILTER_KEYWORDS[activeFilter] ?? []
      : [];

    // Text search
    const q = searchQuery.trim().toLowerCase();

    if (q || kwFilter.length > 0) {
      items = items.filter((item) => {
        if (item.isAd) return true;
        const haystack = [item.title, item.description, item.location ?? "", item.category]
          .join(" ")
          .toLowerCase();
        const textMatch = !q || haystack.includes(q);
        const kwMatch = kwFilter.length === 0 || kwFilter.some((kw) => haystack.includes(kw));
        return textMatch && kwMatch;
      });
    }

    return items;
  }, [allItems, searchQuery, activeFilter, weekRange]);

  const isSearching = searchQuery.trim() !== "" || activeFilter !== null;
  const display = showAll ? filtered : filtered.slice(0, 9);

  function handleFilterToggle(f: QuickFilter) {
    setActiveFilter((prev) => (prev === f ? null : f));
    setShowAll(false);
  }

  function handleSearchChange(v: string) {
    setSearchQuery(v);
    setShowAll(false);
  }

  function clearSearch() {
    setSearchQuery("");
    setActiveFilter(null);
    setShowAll(false);
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: 50 }}>
          <a href={`${BASE}/`} className="inline-flex items-center">
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 50, width: "auto" }} />
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground gap-1"
            onClick={() => { window.location.href = `${BASE}/ad-submit`; }}
          >
            <Megaphone className="w-3.5 h-3.5" /> 광고접수
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-blue-200 text-xs font-semibold tracking-widest uppercase mb-2">강릉의 모든 소식</p>
          <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
            강릉에서 지금 뭐하지?
          </h1>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="강릉 행사·소식 검색"
              className="w-full pl-12 pr-12 py-3.5 rounded-xl text-gray-900 text-sm bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-blue-200 text-xs mt-2 opacity-80">
            예: 단오, 경포, 전시, 공연, 주말, 무료
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-5 w-full">
        {/* Quick filter pills */}
        <div className="relative mb-5">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
          {QUICK_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleFilterToggle(key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border
                ${activeFilter === key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
            >
              {label}
            </button>
          ))}
          {isSearching && (
            <button
              onClick={clearSearch}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-500 transition-all"
            >
              <X className="w-3 h-3" /> 초기화
            </button>
          )}
          </div>
          {/* 오른쪽 끝 페이드 — 더 스크롤할 수 있음을 시각적으로 표시 */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-gray-50 to-transparent" />
        </div>

        {/* Result count */}
        {isSearching && (
          <p className="text-xs text-muted-foreground mb-3">
            {filtered.filter(i => !i.isAd).length}건의 결과
            {activeFilter && <span className="ml-1 font-medium text-blue-600">· {activeFilter}</span>}
            {searchQuery && <span className="ml-1 font-medium text-blue-600">· &ldquo;{searchQuery}&rdquo;</span>}
          </p>
        )}

        {/* Cards Grid */}
        {filtered.filter(i => !i.isAd).length === 0 && isSearching ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Search className="w-12 h-12 mb-3 opacity-15" />
            <p className="text-base font-semibold text-gray-600">검색 결과가 없습니다.</p>
            <p className="text-sm mt-1 text-gray-400">다른 키워드로 다시 찾아보세요.</p>
            <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={clearSearch}>
              전체 보기
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {display.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
            {!showAll && filtered.length > 9 && (
              <div className="mt-8 text-center">
                <Button variant="outline" size="lg" onClick={() => setShowAll(true)}>
                  더 보기 ({filtered.length - 9}건)
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* SNS Section */}
      <section className="bg-white border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-lg font-bold mb-1.5">SNS에서 PLAY강릉 팔로우</h2>
          <p className="text-muted-foreground text-sm mb-5">최신 강릉 소식을 SNS에서 가장 먼저 만나보세요.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Instagram className="w-4 h-4" />인스타그램
            </a>
            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Facebook className="w-4 h-4" />페이스북
            </a>
            <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Youtube className="w-4 h-4" />유튜브
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <img src={`${BASE}/logo.png`} alt="PLAY강릉" className="h-7 object-contain mx-auto mb-3 opacity-60 brightness-0 invert" />
          <p>© 2026 PLAY강릉. 강릉시 공식 SNS 운영 백오피스.</p>
          <p className="mt-1 text-gray-500">강원특별자치도 강릉시</p>
        </div>
      </footer>
    </div>
  );
}
