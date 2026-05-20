import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  CalendarDays, MapPin,
  Megaphone, Star, Pin, Search, X, ArrowUpDown, Play, Menu, Smartphone, ExternalLink,
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
  phone?: string;
  email?: string;
  extraImages?: string[];
  location?: string;
}

interface StoryItem {
  id: string;
  title: string;
  body: string;
  images: string[];
  sourceUrl: string;
  author: string;
  tags: string[];
  status: string;
  createdAt: string;
}

interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string | null;
  description: string;
  status: string;
  createdAt: string;
}

type HomeTab = "전체" | "행사" | "맛집" | "정보" | "스토리" | "영상";
const HOME_TABS: HomeTab[] = ["전체", "행사", "맛집", "정보", "스토리", "영상"];

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
  const pinned = items.filter(i => i.isAd && (i.adPlan === "premium" || i.adPlan === "main"));
  const rest   = items.filter(i => !(i.isAd && (i.adPlan === "premium" || i.adPlan === "main")));

  const sorted = [...rest].sort((a, b) => {
    if (a.isAd && !b.isAd) return -1;
    if (!a.isAd && b.isAd) return 1;

    const sa = SCHEDULE_PRIORITY[a.scheduleStatus] ?? 4;
    const sb = SCHEDULE_PRIORITY[b.scheduleStatus] ?? 4;
    if (sa !== sb) return sa - sb;

    if (sortBy === "latest") {
      return b.date.localeCompare(a.date);
    }
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function FeedCard({ item }: { item: FeedItem }) {
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const category = item.category ?? "지역소식";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  const ytThumb = extractYoutubeThumb(item.videoUrl);
  const hasThumbnail = !!(item.thumbnail || ytThumb);
  const thumbnail = item.thumbnail ?? ytThumb ?? pickFallbackImage(item.id, category);
  const adCfg = item.isAd && item.adPlan ? AD_PLAN_CONFIG[item.adPlan] : null;
  const isToday = item.date === TODAY_STR;
  const gradient = CATEGORY_GRADIENT[category] ?? "from-gray-700 to-gray-900";

  const href = item.isAd ? item.link : (item.sourceUrl || item.link);
  const contentUrl = `${window.location.origin}/content/${item.id}`;

  function openCard() {
    if (item.isAd) {
      setShowDetail(true);
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function copyLink(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(contentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareFacebook(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(contentUrl)}`,
      "_blank"
    );
  }

  async function shareInstagram(e: React.MouseEvent) {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url: contentUrl });
      } catch {
        // 사용자가 취소한 경우 무시
      }
    } else {
      await navigator.clipboard.writeText(contentUrl);
      window.open("https://www.instagram.com/playgangneung/", "_blank");
    }
  }

  return (
    <>
    <div onClick={openCard} className="block cursor-pointer">
      <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${adCfg?.ring ?? ""}`}>
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
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{stripHtml(item.description)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{item.date}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{item.location || item.source}</span>
            </div>
          </div>

          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={copyLink}
              className={`flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-semibold transition-colors
                ${copied ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
            >
              {copied ? "✓ 복사됨" : "🔗 링크복사"}
            </button>
            <button
              onClick={shareFacebook}
              className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-semibold bg-[#1877F2] hover:bg-[#1565C0] text-white transition-colors"
            >
              📘 페북
            </button>
            <button
              onClick={shareInstagram}
              className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-semibold bg-[#E1306C] hover:bg-[#C2185B] text-white transition-colors"
            >
              📸 인스타
            </button>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* 광고 상세 Sheet */}
    {item.isAd && (
      <Sheet open={showDetail} onOpenChange={setShowDetail}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          {/* 이미지 갤러리 */}
          {(() => {
            const allImgs = [item.thumbnail, ...(item.extraImages ?? [])].filter(Boolean) as string[];
            if (allImgs.length === 0) return null;
            if (allImgs.length === 1) return (
              <img src={allImgs[0]} alt={item.title} className="w-full rounded-xl object-cover max-h-60 mb-4" />
            );
            return (
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {allImgs.map((src, i) => (
                  <img key={i} src={src} alt={`사진 ${i+1}`}
                    className={`rounded-xl object-cover w-full ${i === 0 ? "col-span-2 row-span-2 h-48" : "h-[90px]"}`} />
                ))}
              </div>
            );
          })()}
          <div className="flex items-center gap-2 mb-3">
            {item.adPlan && <AdBadge plan={item.adPlan} />}
            <span className="text-sm text-muted-foreground">{item.businessName}</span>
            <span className="ml-auto text-xs text-muted-foreground bg-gray-100 rounded-full px-2 py-0.5">{category}</span>
          </div>
          <h2 className="font-bold text-lg leading-snug mb-3">{item.title}</h2>
          {item.description && (
            <div
              className="prose prose-sm max-w-none text-gray-700 mb-4 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}
          {item.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />{item.location}
            </div>
          )}
          {(item.phone || item.email) && (
            <div className="space-y-1 mb-4 mt-2 border rounded-xl p-3 bg-gray-50 text-sm">
              {item.phone && (
                <a href={`tel:${item.phone}`} className="flex items-center gap-2 text-blue-600 font-medium">
                  📞 {item.phone}
                </a>
              )}
              {item.email && (
                <a href={`mailto:${item.email}`} className="flex items-center gap-2 text-blue-600">
                  ✉️ {item.email}
                </a>
              )}
            </div>
          )}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm"
            >
              자세히 보기 →
            </a>
          )}
        </SheetContent>
      </Sheet>
    )}
    </>
  );
}

function StoryCard({ item }: { item: StoryItem }) {
  const [open, setOpen] = useState(false);
  const firstImage = item.images[0];
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="rounded-2xl overflow-hidden bg-gray-900 text-white cursor-pointer hover:brightness-110 transition-all"
      >
        {firstImage && (
          <div className="relative h-48 overflow-hidden">
            <img src={firstImage} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        )}
        <div className="p-4">
          {item.author && (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                {item.author[0]}
              </div>
              <span className="text-xs text-gray-400">{item.author}</span>
            </div>
          )}
          <h3 className="font-bold text-base leading-snug mb-2 line-clamp-2">{item.title}</h3>
          {item.body && (
            <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{item.body}</p>
          )}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {item.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">#{tag}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-600 mt-3">
            {new Date(item.createdAt).toLocaleDateString("ko-KR")}
          </p>
        </div>
      </div>

      {/* 상세 패널 */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
          {firstImage && (
            <div className="relative h-56 shrink-0 bg-gray-100 overflow-hidden">
              <img src={firstImage} alt={item.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {item.author && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {item.author[0]}
                </div>
                <span className="text-sm font-medium">{item.author}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            )}
            <h2 className="font-bold text-lg leading-snug">{item.title}</h2>
            {item.body && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.body}</p>
            )}
            {item.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {item.tags.filter(Boolean).map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
            )}
          </div>
          {item.sourceUrl && (
            <div className="border-t p-4 shrink-0">
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />원문 보기
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function VideoCard({ item }: { item: VideoItem }) {
  const [playing, setPlaying] = useState(false);
  const thumb = item.thumbnailUrl ?? (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/maxresdefault.jpg` : null);

  if (playing && item.youtubeId) {
    return (
      <div className="rounded-2xl overflow-hidden bg-black shadow-lg">
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1`}
            title={item.title}
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="p-3 bg-gray-900">
          <h3 className="text-white font-semibold text-sm line-clamp-2">{item.title}</h3>
          {item.channelName && <p className="text-gray-400 text-xs mt-1">{item.channelName}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      className="rounded-2xl overflow-hidden bg-gray-900 cursor-pointer hover:brightness-110 transition-all shadow-lg"
    >
      <div className="relative h-48 overflow-hidden bg-gray-800">
        {thumb ? (
          <img src={thumb} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gray-800" />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-3 bg-gray-900">
        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{item.title}</h3>
        {item.channelName && (
          <p className="text-gray-400 text-xs">{item.channelName}</p>
        )}
        {item.description && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [activeTab, setActiveTab] = useState<HomeTab>("전체");
  const inputRef = useRef<HTMLInputElement>(null);
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [installGuide, setInstallGuide] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

  const { data: storiesData } = useQuery<{ stories: StoryItem[] }>({
    queryKey: ["public-stories"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stories`);
      if (!res.ok) throw new Error("스토리 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
    enabled: activeTab === "스토리" || activeTab === "전체",
  });

  const { data: videosData } = useQuery<{ videos: VideoItem[] }>({
    queryKey: ["public-videos"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/videos`);
      if (!res.ok) throw new Error("영상 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
    enabled: activeTab === "영상" || activeTab === "전체",
  });

  const allItems: FeedItem[] = data?.feed?.length ? data.feed : FALLBACK_FEED;
  const stories: StoryItem[] = storiesData?.stories ?? [];
  const videos: VideoItem[] = videosData?.videos ?? [];

  const tabBaseItems = useMemo(() => {
    if (activeTab === "행사") return allItems.filter(i => i.category === "행사");
    if (activeTab === "맛집") return allItems.filter(i => ["맛집", "카페"].includes(i.category));
    if (activeTab === "정보") return allItems.filter(i => ["핫플", "지역소식"].includes(i.category));
    return allItems;
  }, [allItems, activeTab]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? tabBaseItems.filter((item) => {
          if (item.isAd) return true;
          const haystack = [item.title, item.description, item.location ?? "", item.category]
            .join(" ").toLowerCase();
          return haystack.includes(q);
        })
      : tabBaseItems;
    return sortFeed(base, sortBy);
  }, [tabBaseItems, searchQuery, sortBy]);

  const isSearching = searchQuery.trim() !== "";
  const display = showAll ? filtered : filtered.slice(0, 9);

  function handleTabChange(tab: HomeTab) {
    setActiveTab(tab);
    setShowAll(false);
    setSearchQuery("");
  }

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

  const isEventTab = activeTab === "전체" || activeTab === "행사" || activeTab === "맛집" || activeTab === "정보";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: 64 }}>
          <a href={`${BASE}/`} className="inline-flex items-center">
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 56, width: "auto", marginTop: 5 }} />
          </a>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSearchOpen((v) => !v); setMenuOpen(false); }}
              className="flex flex-col items-center justify-center w-14 h-14 rounded-full hover:bg-gray-100 transition-colors gap-0.5"
              aria-label="검색"
            >
              <div className="w-8 h-8 rounded-full border-2 border-gray-700 flex items-center justify-center">
                <Search className="w-4 h-4 text-gray-900" />
              </div>
              <span className="text-[12px] text-gray-700 leading-none font-medium">검색</span>
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen((v) => !v); setSearchOpen(false); }}
                className="flex items-center justify-center w-12 h-14 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="메뉴"
              >
                <Menu className="w-7 h-7 text-gray-700" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      if (installPrompt) {
                        await installPrompt.prompt();
                        setInstallPrompt(null);
                      } else {
                        setInstallGuide(true);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-blue-600 font-semibold hover:bg-blue-50 transition-colors border-b border-gray-100"
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    홈화면에 바로가기 추가
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); window.location.href = `${BASE}/ad-submit`; }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Megaphone className="w-4 h-4 shrink-0" />
                    광고접수
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="max-w-6xl mx-auto flex border-t border-gray-100">
          {HOME_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-blue-600 border-blue-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 검색 패널 */}
        {searchOpen && isEventTab && (
          <div className="border-t border-gray-100 bg-white px-4 py-2.5">
            <div className="relative max-w-6xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="강릉 행사·소식 검색"
                className="w-full pl-9 pr-9 py-2.5 rounded-lg text-gray-900 text-sm bg-gray-100 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400 transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-3 pb-4 w-full">
        {activeTab === "스토리" ? (
          stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <p className="text-base font-semibold text-gray-500">아직 등록된 스토리가 없습니다.</p>
              <p className="text-sm mt-1 text-gray-400">곧 강릉의 이야기를 전해드릴게요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map((s) => <StoryCard key={s.id} item={s} />)}
            </div>
          )
        ) : activeTab === "영상" ? (
          videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <p className="text-base font-semibold text-gray-500">아직 등록된 영상이 없습니다.</p>
              <p className="text-sm mt-1 text-gray-400">강릉의 영상을 큐레이션 중입니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((v) => <VideoCard key={v.id} item={v} />)}
            </div>
          )
        ) : (
          <>
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
            ) : filtered.filter(i => !i.isAd).length === 0 && !isSearching ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <p className="text-base font-semibold text-gray-500">아직 등록된 콘텐츠가 없습니다.</p>
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
              <span className="text-gray-400 font-medium">이메일</span>{" "}
              <a href="mailto:event62@gmail.com" className="hover:text-gray-300 transition-colors">event62@gmail.com</a>
            </p>
            <p>
              <span className="text-gray-400 font-medium">주소</span>{" "}
              강원특별자치도 강릉시 사천면 진리해변길 37 103-1101
            </p>
          </div>

          <p className="mt-4 text-[11px] text-gray-600">
            © 2026 PLAY강릉. All rights reserved.
            <a href={`${BASE}/admin`} className="ml-2 text-gray-900 select-none" tabIndex={-1} aria-hidden="true">·</a>
          </p>
        </div>
      </footer>

      {/* 홈화면 추가 안내 모달 */}
      {installGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50"
          onClick={() => setInstallGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-2xl p-6 pb-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <img src={`${BASE}/logo.png`} alt="" className="w-12 h-12 rounded-2xl object-contain bg-blue-50 p-1 border border-blue-100" />
              <div>
                <p className="font-bold text-gray-900 text-base">PLAY강릉 홈화면 추가</p>
                <p className="text-xs text-gray-500">앱처럼 바로 실행할 수 있습니다</p>
              </div>
            </div>
            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span>Safari 하단의 <strong>공유 버튼(□↑)</strong>을 누릅니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span>스크롤해서 <strong>"홈 화면에 추가"</strong>를 선택합니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span>오른쪽 위 <strong>"추가"</strong>를 누르면 완료!</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span>Chrome 주소창 오른쪽 <strong>⋮ 메뉴</strong>를 누릅니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span><strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 선택합니다</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span><strong>"추가"</strong>를 누르면 홈화면에 아이콘이 생깁니다</span>
                </li>
              </ol>
            )}
            <button
              onClick={() => setInstallGuide(false)}
              className="mt-6 w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
