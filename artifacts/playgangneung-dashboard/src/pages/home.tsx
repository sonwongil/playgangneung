import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays, MapPin,
  Megaphone, Star, Pin, Search, X, ArrowUpDown, Play,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface FeedItem {
  id: string;
  title: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
  scheduleStatus: string;
  link: string;
  sourceUrl: string;
  source: string;
  category: string;
  thumbnail: string | null;
  videoUrl?: string | null;
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

const SCHEDULE_PRIORITY: Record<string, number> = {
  today: 0, ongoing: 1, tomorrow: 2, upcoming: 3, dateUnknown: 4, ended: 5,
};

type SortBy = "date" | "latest";

function sortFeed(items: FeedItem[], sortBy: SortBy): FeedItem[] {
  // premium/main 광고는 항상 최상단 고정
  const pinned = items.filter(i => i.isAd && (i.adPlan === "premium" || i.adPlan === "main"));
  const rest   = items.filter(i => !(i.isAd && (i.adPlan === "premium" || i.adPlan === "main")));

  const sorted = [...rest].sort((a, b) => {
    // 광고 우선
    if (a.isAd && !b.isAd) return -1;
    if (!a.isAd && b.isAd) return 1;

    const sa = SCHEDULE_PRIORITY[a.scheduleStatus] ?? 4;
    const sb = SCHEDULE_PRIORITY[b.scheduleStatus] ?? 4;
    if (sa !== sb) return sa - sb;

    if (sortBy === "latest") {
      // 최신순: 시작일 내림차순 (ended는 이미 맨 뒤)
      return b.date.localeCompare(a.date);
    }
    // 날짜순: ended는 최근 종료 먼저, 나머지는 가까운 날짜 먼저
    if (a.scheduleStatus === "ended") return b.date.localeCompare(a.date);
    return a.date.localeCompare(b.date);
  });

  return [...pinned, ...sorted];
}

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

function AdBadge({ plan }: { plan: "basic" | "main" | "premium" }) {
  const cfg = AD_PLAN_CONFIG[plan];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const CATEGORY_GRADIENT: Record<string, string> = {
  행사: "from-blue-700 to-blue-950",
  맛집: "from-orange-500 to-red-800",
  핫플: "from-purple-600 to-indigo-900",
  지역소식: "from-emerald-600 to-teal-900",
};

function FeedCard({ item }: { item: FeedItem }) {
  const category = item.category ?? "지역소식";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  const hasThumbnail = !!item.thumbnail;
  const thumbnail = item.thumbnail ?? pickFallbackImage(item.id, category);
  const adCfg = item.isAd && item.adPlan ? AD_PLAN_CONFIG[item.adPlan] : null;
  const isToday = item.date === TODAY_STR;
  const gradient = CATEGORY_GRADIENT[category] ?? "from-gray-700 to-gray-900";

  const href = item.isAd ? item.link : (item.sourceUrl || item.link);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer ${adCfg?.ring ?? ""}`}>
        {adCfg && (item.adPlan === "premium" || item.adPlan === "main") && (
          <div className={`${adCfg.banner} flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold`}>
            {adCfg.icon}
            <span>{adCfg.label}</span>
            <span className="ml-auto opacity-80 text-[10px]">{item.businessName}</span>
          </div>
        )}
        <div className="relative h-52 overflow-hidden bg-gray-100">
          {hasThumbnail ? (
            <>
              <img
                src={thumbnail}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
              />
              <img
                src={thumbnail}
                alt={item.title}
                className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </>
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col justify-end p-4 group-hover:brightness-110 transition-all`}>
              <p className="text-white font-bold text-lg leading-snug line-clamp-3 drop-shadow">{item.title}</p>
              <p className="text-white/70 text-xs mt-2">{item.source} · {item.date}</p>
            </div>
          )}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
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
          {item.videoUrl && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-black/70 text-white rounded-full px-2 py-1 text-[11px] font-bold">
              <Play className="w-3 h-3 fill-white" />동영상
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-base leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
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
        </CardContent>
      </Card>
    </a>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery<{ feed: FeedItem[]; total: number }>({
    queryKey: ["public-feed"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/feed`);
      if (!res.ok) throw new Error("피드 로드 실패");
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const allItems: FeedItem[] = data?.feed?.length ? data.feed : FALLBACK_FEED;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? allItems.filter((item) => {
          if (item.isAd) return true;
          const haystack = [item.title, item.description, item.location ?? "", item.category]
            .join(" ").toLowerCase();
          return haystack.includes(q);
        })
      : allItems;
    return sortFeed(base, sortBy);
  }, [allItems, searchQuery, sortBy]);

  const isSearching = searchQuery.trim() !== "";
  const display = showAll ? filtered : filtered.slice(0, 9);

  function handleSearchChange(v: string) {
    setSearchQuery(v);
    setShowAll(false);
  }

  function handleSortChange(s: SortBy) {
    setSortBy(s);
    setShowAll(false);
  }

  function clearSearch() {
    setSearchQuery("");
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
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-3 pb-4 w-full">
        {/* Toolbar: 검색 결과 + 정렬 버튼 */}
        <div className="flex items-center justify-between mb-3 min-h-[28px]">
          {isSearching ? (
            <p className="text-xs text-muted-foreground">
              {filtered.filter(i => !i.isAd).length}건의 결과
              <span className="ml-1 font-medium text-blue-600">· &ldquo;{searchQuery}&rdquo;</span>
              <button onClick={clearSearch} className="ml-2 underline text-gray-400 hover:text-gray-600">초기화</button>
            </p>
          ) : <span />}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
            <button
              onClick={() => handleSortChange("date")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                sortBy === "date"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              날짜순
            </button>
            <button
              onClick={() => handleSortChange("latest")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                sortBy === "latest"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              최신순
            </button>
          </div>
        </div>

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

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <img src={`${BASE}/logo_transparent.png`} alt="PLAY강릉" className="h-10 object-contain mx-auto mb-3" />

          <div className="text-[11px] leading-relaxed space-y-0.5 text-gray-500">
            <p>
              <span className="text-gray-400 font-medium">상호</span> 플레이강릉
              <span className="mx-2 text-gray-700">|</span>
              <span className="text-gray-400 font-medium">대표자</span> 손원길
              <span className="mx-2 text-gray-700">|</span>
              <span className="text-gray-400 font-medium">정보책임자</span> 손원길
            </p>
            <p>
              <span className="text-gray-400 font-medium">사업자등록번호</span> 292-07-03357
              <span className="mx-2 text-gray-700">|</span>
              <span className="text-gray-400 font-medium">개업일</span> 2026. 05. 11
            </p>
            <p>
              <span className="text-gray-400 font-medium">주소</span>{" "}
              강원특별자치도 강릉시 사천면 진리해변길 37, 103동 1101호
            </p>
            <p>
              <span className="text-gray-400 font-medium">업태</span> 정보통신업
              <span className="mx-2 text-gray-700">|</span>
              <span className="text-gray-400 font-medium">종목</span> 뉴스 제공업 · 영상물 및 데이터베이스 정보 제공업 · 행사 대행업
            </p>
          </div>

          <p className="mt-4 text-[11px] text-gray-600">
            © 2026 PLAY강릉. All rights reserved.
            <a href={`${BASE}/admin`} className="ml-2 text-gray-900 select-none" tabIndex={-1} aria-hidden="true">·</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
