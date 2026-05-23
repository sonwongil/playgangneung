import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarDays, MapPin, Megaphone, Star, Pin, Search, X, Play,
  Menu, Smartphone, ChevronLeft, ChevronRight, Home as HomeIcon, LogIn, LogOut, Flame,
  Heart, MessageCircle, Eye, Users, TrendingUp, Pencil,
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
  hashtags?: string[];
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

const PREDEFINED_TAGS = ["전체", "오늘의행사", "행사", "맛집", "정보", "스토리", "영상"] as const;
type PredefinedTag = typeof PREDEFINED_TAGS[number];

const CATEGORY_COLORS: Record<string, string> = {
  행사: "bg-blue-100 text-blue-700",
  맛집: "bg-orange-100 text-orange-700",
  핫플: "bg-pink-100 text-pink-700",
  지역소식: "bg-green-100 text-green-700",
};

const AD_PLAN_CONFIG = {
  premium: {
    label: "프리미엄 광고", icon: <Star className="w-3 h-3" />,
    ring: "ring-2 ring-amber-400",
    banner: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    badge: "bg-amber-100 text-amber-700",
  },
  main: {
    label: "메인 광고", icon: <Pin className="w-3 h-3" />,
    ring: "ring-2 ring-blue-400",
    banner: "bg-gradient-to-r from-blue-600 to-blue-500 text-white",
    badge: "bg-blue-100 text-blue-700",
  },
  basic: {
    label: "광고", icon: <Megaphone className="w-3 h-3" />,
    ring: "", banner: "", badge: "bg-gray-100 text-gray-600",
  },
};

const CATEGORY_GRADIENT: Record<string, string> = {
  행사: "from-blue-700 to-blue-950",
  맛집: "from-orange-500 to-red-800",
  핫플: "from-purple-600 to-indigo-900",
  지역소식: "from-emerald-600 to-teal-900",
};

const CATEGORY_FALLBACK_POOL: Record<string, string[]> = {
  행사: [
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
  ],
  맛집: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
  ],
  핫플: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80"],
  지역소식: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"],
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
  } catch { /* noop */ }
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function proxyImg(url: string): string {
  return `${BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function isTodayEvent(item: FeedItem): boolean {
  if (!item.startDate && !item.date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(item.startDate || item.date);
  start.setHours(0, 0, 0, 0);
  const end = item.endDate ? new Date(item.endDate) : new Date(start);
  end.setHours(23, 59, 59, 999);
  return today >= start && today <= end;
}

function AdBadge({ plan }: { plan: "basic" | "main" | "premium" }) {
  const cfg = AD_PLAN_CONFIG[plan];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function ImageSlider({ images, onClickImage }: { images: string[]; onClickImage: (i: number) => void }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };
  return (
    <div className="relative w-full h-56 rounded-xl overflow-hidden mb-4 bg-black select-none">
      <img src={images[idx]} alt={`사진 ${idx + 1}`} className="w-full h-full object-cover cursor-zoom-in" onClick={(e) => { e.stopPropagation(); onClickImage(idx); }} />
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (<button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white scale-125" : "bg-white/50"}`} />))}
          </div>
          <span className="absolute top-2 right-2 bg-black/40 text-white text-[11px] font-semibold rounded-full px-2 py-0.5">{idx + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}

function LightboxModal({ images, startIdx, open, onClose }: { images: string[]; startIdx: number; open: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  useEffect(() => { setIdx(startIdx); }, [startIdx, open]);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, images.length]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-screen-md w-full p-0 bg-black border-none" aria-describedby={undefined}>
        <div className="relative flex items-center justify-center min-h-[60vh]">
          <img src={images[idx]} alt={`사진 ${idx + 1}`} className="max-h-[80vh] max-w-full object-contain" />
          {images.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronLeft className="w-6 h-6" /></button>
              <button onClick={next} className="absolute right-2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white"><ChevronRight className="w-6 h-6" /></button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (<button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === idx ? "bg-white scale-125" : "bg-white/40"}`} />))}
              </div>
              <span className="absolute top-3 right-3 bg-black/50 text-white text-xs font-semibold rounded-full px-2.5 py-1">{idx + 1} / {images.length}</span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedCard({ item, onTagClick }: { item: FeedItem; onTagClick?: (tag: string) => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const category = item.category ?? "지역소식";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  const ytThumb = extractYoutubeThumb(item.videoUrl);
  const hasThumbnail = !!(item.thumbnail || ytThumb);
  const thumbnail = item.thumbnail ?? ytThumb ?? pickFallbackImage(item.id, category);
  const adCfg = item.isAd && item.adPlan ? AD_PLAN_CONFIG[item.adPlan] : null;
  const gradient = CATEGORY_GRADIENT[category] ?? "from-gray-700 to-gray-900";

  function openCard() {
    if (item.isAd) { setShowDetail(true); return; }
    window.open(`/content/${item.id}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div onClick={openCard} className="block cursor-pointer">
        <Card className={`overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${adCfg?.ring ?? ""}`}>
          {adCfg && (item.adPlan === "premium" || item.adPlan === "main") && (
            <div className={`${adCfg.banner} flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold`}>
              {adCfg.icon}<span>{adCfg.label}</span>
              <span className="ml-auto opacity-80 text-[10px]">{item.businessName}</span>
            </div>
          )}
          <div className="relative h-48 overflow-hidden bg-gray-100">
            {hasThumbnail ? (
              <>
                <img src={thumbnail} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60" />
                <img src={thumbnail} alt={item.title} className="relative z-10 w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </>
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col justify-end p-4 group-hover:brightness-110 transition-all`}>
                <p className="text-white font-bold text-lg leading-snug line-clamp-3 drop-shadow">{item.title}</p>
                <p className="text-white/70 text-xs mt-2">{item.source} · {item.date}</p>
              </div>
            )}
            <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
              {item.isAd && item.adPlan ? (
                <AdBadge plan={item.adPlan} />
              ) : (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{category}</span>
              )}
            </div>
            {item.videoUrl && (
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/70 text-white rounded-full px-2 py-1 text-[11px] font-bold">
                <Play className="w-3 h-3 fill-white" />동영상
              </div>
            )}
          </div>
          <CardContent className="p-3">
            <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{stripHtml(item.description)}</p>
            {/* 해시태그 */}
            {item.hashtags && item.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
                {item.hashtags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTagClick?.(tag)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                <span>{item.date}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{item.location || item.source}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {item.isAd && (
        <Sheet open={showDetail} onOpenChange={setShowDetail}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {(() => {
              const allImgs = [item.thumbnail, ...(item.extraImages ?? [])].filter(Boolean) as string[];
              if (allImgs.length === 0) return null;
              return <ImageSlider images={allImgs} onClickImage={(i) => { setLightboxIdx(i); setLightboxOpen(true); }} />;
            })()}
            <div className="flex items-center gap-2 mb-3">
              {item.adPlan && <AdBadge plan={item.adPlan} />}
              <span className="text-sm text-muted-foreground">{item.businessName}</span>
              <span className="ml-auto text-xs text-muted-foreground bg-gray-100 rounded-full px-2 py-0.5">{category}</span>
            </div>
            <h2 className="font-bold text-lg leading-snug mb-3">{item.title}</h2>
            {item.description && <div className="prose prose-sm max-w-none text-gray-700 mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.description }} />}
            {item.location && <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2"><MapPin className="w-4 h-4" />{item.location}</div>}
            {(item.phone || item.email) && (
              <div className="space-y-1 mb-4 mt-2 border rounded-xl p-3 bg-gray-50 text-sm">
                {item.phone && <a href={`tel:${item.phone}`} className="flex items-center gap-2 text-blue-600 font-medium">📞 {item.phone}</a>}
                {item.email && <a href={`mailto:${item.email}`} className="flex items-center gap-2 text-blue-600">✉️ {item.email}</a>}
              </div>
            )}
            <a href={`/content/${item.id}`} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm">자세히 보기 →</a>
          </SheetContent>
        </Sheet>
      )}
      {lightboxOpen && (() => {
        const allImgs = [item.thumbnail, ...(item.extraImages ?? [])].filter(Boolean) as string[];
        return <LightboxModal images={allImgs} startIdx={lightboxIdx} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />;
      })()}
    </>
  );
}

const STORY_GRADIENTS = ["from-blue-800 to-blue-600", "from-purple-800 to-purple-600", "from-emerald-800 to-emerald-600", "from-rose-800 to-rose-600", "from-orange-800 to-orange-600"];

function StoryCard({ item }: { item: StoryItem }) {
  const firstImage = item.images[0];
  const gradient = STORY_GRADIENTS[item.id.charCodeAt(0) % STORY_GRADIENTS.length];
  return (
    <a href={item.sourceUrl || "#"} target="_blank" rel="noopener noreferrer" className="block rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300 group bg-gray-900">
      <div className="relative h-44 overflow-hidden">
        {firstImage ? <img src={proxyImg(firstImage)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement?.querySelector(".story-fallback")?.classList.remove("hidden"); }} /> : null}
        <div className={`story-fallback w-full h-full bg-gradient-to-br ${gradient} absolute inset-0 ${firstImage ? "hidden" : ""}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {item.author && <div className="flex items-center gap-1.5 mb-1.5"><div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{item.author[0]}</div><span className="text-[11px] text-white/70 truncate">{item.author}</span></div>}
          <h3 className="font-bold text-sm text-white leading-snug line-clamp-2">{item.title}</h3>
        </div>
      </div>
      {item.tags?.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map(tag => <span key={tag} className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">#{tag}</span>)}
          <span className="text-[11px] text-gray-600 ml-auto">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
      )}
    </a>
  );
}

function VideoCard({ item }: { item: VideoItem }) {
  const [playing, setPlaying] = useState(false);
  const thumb = item.thumbnailUrl ?? (item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/maxresdefault.jpg` : null);
  if (playing && item.youtubeId) {
    return (
      <div className="rounded-2xl overflow-hidden bg-black shadow-lg">
        <div className="relative" style={{ paddingBottom: "56.25%" }}>
          <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1`} title={item.title} allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
        </div>
        <div className="p-3 bg-gray-900"><h3 className="text-white font-semibold text-sm line-clamp-2">{item.title}</h3>{item.channelName && <p className="text-gray-400 text-xs mt-1">{item.channelName}</p>}</div>
      </div>
    );
  }
  return (
    <div onClick={() => setPlaying(true)} className="rounded-2xl overflow-hidden bg-gray-900 cursor-pointer hover:brightness-110 transition-all shadow-lg">
      <div className="relative h-48 overflow-hidden bg-gray-800">
        {thumb ? <img src={thumb} alt={item.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-gray-800" />}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-lg"><Play className="w-6 h-6 text-white fill-white ml-0.5" /></div>
        </div>
      </div>
      <div className="p-3 bg-gray-900">
        <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{item.title}</h3>
        {item.channelName && <p className="text-gray-400 text-xs">{item.channelName}</p>}
        {item.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.description}</p>}
      </div>
    </div>
  );
}


function HashtagPill({ tag, active, onClick }: { tag: string; active: boolean; onClick: () => void }) {
  const label = tag.startsWith("#") ? tag : `#${tag}`;
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-5 py-2 rounded-full text-[18px] font-bold transition-all ${
        active
          ? "bg-gray-900 text-white shadow-sm"
          : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

function fakeStats(id: string): { likes: string; comments: string; views: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31 + id.charCodeAt(i)) & 0x7fffffff);
  const likes = 30 + (h % 250);
  const comments = 3 + ((h >>> 4) % 60);
  const views = 400 + ((h >>> 8) % 8000);
  return {
    likes: likes.toString(),
    comments: comments.toString(),
    views: views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views.toString(),
  };
}

export default function Home() {
  const [activeTag, setActiveTag] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => Promise<void> } | null>(null);
  const [installGuide, setInstallGuide] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hashtagBarRef = useRef<HTMLDivElement>(null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as Event & { prompt: () => Promise<void> }); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // bfcache(뒤로가기 캐시)로 복원될 때 강제 새로고침하여 최신 화면 표시
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const { data: feedData } = useQuery<{ feed: FeedItem[]; total: number }>({
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
    enabled: activeTag === "스토리" || activeTag === "전체",
  });

  const { data: videosData } = useQuery<{ videos: VideoItem[] }>({
    queryKey: ["public-videos"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/videos`);
      if (!res.ok) throw new Error("영상 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
    enabled: activeTag === "영상" || activeTag === "전체",
  });

  const { data: popularTagsData } = useQuery<{ tags: { tag: string; count: number }[] }>({
    queryKey: ["popular-tags"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/tags/popular`);
      if (!res.ok) throw new Error("태그 로드 실패");
      return res.json();
    },
    staleTime: 300_000,
  });

  const { data: authData } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/me`);
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
    staleTime: 60_000,
  });

  interface PremiumAd {
    id: string;
    title: string;
    businessName: string;
    imageUrl: string | null;
    extraImages?: string[];
    category: string;
    url: string;
    adPlan: "basic" | "main" | "premium";
    status: string;
  }
  interface BannerConfig {
    subtitle: string;
    stat1Label: string;
    stat1Value: string;
    stat2Label: string;
    stat2Value: string;
    stat3Label: string;
    stat3Value: string;
    ctaText: string;
  }

  const { data: premiumAdsData } = useQuery<{ ads: PremiumAd[] }>({
    queryKey: ["premium-ads"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ads/premium-featured`);
      if (!res.ok) throw new Error("프리미엄 광고 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: bannerConfig } = useQuery<BannerConfig>({
    queryKey: ["banner-config"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/banner-config`);
      if (!res.ok) throw new Error("배너 설정 로드 실패");
      return res.json();
    },
    staleTime: 300_000,
  });

  const premiumAds = premiumAdsData?.ads ?? [];
  const [premiumIdx, setPremiumIdx] = useState(0);
  const premiumIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToPremium = useCallback((idx: number) => {
    setPremiumIdx((prev) => {
      const len = premiumAds.length;
      if (len === 0) return 0;
      return ((idx % len) + len) % len;
    });
  }, [premiumAds.length]);

  useEffect(() => {
    if (premiumAds.length <= 1) return;
    premiumIntervalRef.current = setInterval(() => {
      setPremiumIdx((prev) => (prev + 1) % premiumAds.length);
    }, 3000);
    return () => { if (premiumIntervalRef.current) clearInterval(premiumIntervalRef.current); };
  }, [premiumAds.length]);

  const allFeed: FeedItem[] = feedData?.feed ?? [];
  const stories: StoryItem[] = storiesData?.stories ?? [];
  const videos: VideoItem[] = videosData?.videos ?? [];
  const popularTags = (popularTagsData?.tags ?? []).filter((t) => !PREDEFINED_TAGS.includes(t.tag.replace(/^#/, "") as PredefinedTag) && !PREDEFINED_TAGS.includes(t.tag as PredefinedTag));

  const premiumSectionItems: (PremiumAd | FeedItem)[] = useMemo(() => {
    const adIds = new Set(premiumAds.map((a) => a.id));
    const topFeed = allFeed.filter((f) => !adIds.has(f.id)).slice(0, Math.max(0, 8 - premiumAds.length));
    return [...premiumAds, ...topFeed];
  }, [premiumAds, allFeed]);

  const filteredFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let base = allFeed;

    if (activeTag === "오늘의행사") {
      base = allFeed.filter((e) => !e.isAd && isTodayEvent(e));
    } else if (activeTag === "행사") {
      base = allFeed.filter((e) => e.isAd || e.category === "행사");
    } else if (activeTag === "맛집") {
      base = allFeed.filter((e) => e.isAd || ["맛집", "카페"].includes(e.category));
    } else if (activeTag === "정보") {
      base = allFeed.filter((e) => e.isAd || ["핫플", "지역소식"].includes(e.category));
    } else if (activeTag !== "전체" && activeTag !== "스토리" && activeTag !== "영상") {
      const tag = activeTag.startsWith("#") ? activeTag : `#${activeTag}`;
      base = allFeed.filter((e) => e.hashtags?.includes(tag) || e.hashtags?.includes(activeTag));
    }

    if (q) {
      base = base.filter((item) => {
        if (item.isAd) return true;
        const haystack = [item.title, item.description, item.location ?? "", item.category, ...(item.hashtags ?? [])]
          .join(" ").toLowerCase();
        return haystack.includes(q) || haystack.includes(q.replace(/^#/, ""));
      });
    }

    return base;
  }, [allFeed, activeTag, searchQuery]);

  function handleTagClick(tag: string) {
    setActiveTag(tag);
    setShowAll(false);
    setSearchQuery("");
    hashtagBarRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  function clearSearch() {
    setSearchQuery("");
    setShowAll(false);
  }

  const showFeed = activeTag !== "스토리" && activeTag !== "영상";
  const display = showAll ? filteredFeed : filteredFeed.slice(0, 12);
  const isSearching = searchQuery.trim() !== "";
  const isFiltered = activeTag !== "전체" || isSearching;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─── 상단 고정 영역 ─── */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-3 flex items-center gap-2 w-full" style={{ height: 56 }}>
          <Link href="/" className="flex-shrink-0">
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 44, width: "auto" }} />
          </Link>

          {/* 검색창 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowAll(false); }}
              placeholder="행사, 맛집, 핫플... (예: 안목 카페, 야시장)"
              className="w-full pl-9 pr-8 py-2 rounded-full text-sm bg-gray-100 text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400 transition-colors"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

            {/* 광고 접수 버튼 */}
          <Link
            href="/ad-submit"
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
            title="광고 접수"
          >
            <Pencil className="w-4.5 h-4.5 text-gray-600" style={{ width: 18, height: 18 }} />
          </Link>

          {/* 공동광고 아이콘 */}
          <Link
            href="/ad-submit"
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full hover:bg-orange-50 transition-colors"
            title="공동광고 지원센터"
          >
            <Megaphone className="w-4.5 h-4.5 text-gray-600" style={{ width: 18, height: 18 }} />
          </Link>

          {/* 메뉴 */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <a
                  href="https://playgangneung.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <HomeIcon className="w-4 h-4 shrink-0 text-blue-600" />
                  홈페이지 바로가기
                </a>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); }
                    else setInstallGuide(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  홈화면에 추가
                </button>
                {authData?.isAdmin ? (
                  <>
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100" onClick={() => setMenuOpen(false)}>
                      <LogIn className="w-4 h-4 shrink-0" />관리자 페이지
                    </Link>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await fetch(`${BASE}/api/auth/logout`, { method: "POST" });
                        window.location.reload();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />로그아웃
                    </button>
                  </>
                ) : (
                  <Link href="/login" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setMenuOpen(false)}>
                    <LogIn className="w-4 h-4 shrink-0" />관리자 로그인
                  </Link>
                )}
              </div>
            )}
          </div>
        </header>

        {/* 해시태그 바 - 가로 스크롤 + 우측 고정 광고 버튼 */}
        <div className="flex items-stretch border-t border-gray-100">
          <div
            ref={hashtagBarRef}
            className="flex items-center justify-center gap-0.5 px-3 py-2 overflow-x-auto flex-1 min-w-0"
            style={{ scrollbarWidth: "none" }}
          >
            {PREDEFINED_TAGS.filter((tag) => tag !== "전체" && tag !== "오늘의행사").map((tag) => (
              <HashtagPill key={tag} tag={tag} active={activeTag === tag} onClick={() => handleTagClick(tag)} />
            ))}
            {popularTags.map((t) => (
              <HashtagPill key={t.tag} tag={t.tag} active={activeTag === t.tag} onClick={() => handleTagClick(t.tag)} />
            ))}
          </div>
          {/* 우측 고정 공동광고 버튼 */}
          <Link
            href="/ad-submit"
            className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 transition-colors border-l border-orange-400"
          >
            <Megaphone className="w-3.5 h-3.5 text-white shrink-0" />
            <div className="leading-none">
              <p className="text-[11px] font-extrabold text-white whitespace-nowrap">공동광고 지원센터</p>
              <p className="text-[9px] text-orange-100 mt-0.5 whitespace-nowrap">하루 15,000원으로 강릉에 노출!</p>
            </div>
            <ChevronRight className="w-3 h-3 text-white/80 shrink-0" />
          </Link>
        </div>
      </div>

      {/* ─── 메인 콘텐츠 ─── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 pt-3 pb-6">

        {/* 스토리 탭 */}
        {activeTag === "스토리" && (
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
        )}

        {/* 영상 탭 */}
        {activeTag === "영상" && (
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
        )}

        {/* 피드 뷰 (스토리/영상 외 모든 탭) */}
        {showFeed && (
          <>
            {/* 🔥 PLAY 추천 · 프리미엄 콘텐츠 (가로 스크롤 카드) */}
            {!isFiltered && premiumSectionItems.length > 0 && (
              <section className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">🔥</span>
                    <span className="text-sm font-extrabold text-gray-900">PLAY 추천</span>
                    <span className="text-sm text-gray-300 mx-0.5">|</span>
                    <span className="text-sm font-bold text-gray-600">프리미엄 콘텐츠</span>
                  </div>
                  <button className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium">
                    전체보기 <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div
                  className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3"
                  style={{ scrollbarWidth: "none" }}
                >
                  {premiumSectionItems.map((item) => {
                    const isAd = "businessName" in item;
                    const thumb = isAd
                      ? ((item as PremiumAd).imageUrl ?? ((item as PremiumAd).extraImages?.[0]) ?? null)
                      : ((item as FeedItem).thumbnail ?? extractYoutubeThumb((item as FeedItem).videoUrl));
                    const thumbSrc = thumb ?? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80";
                    const title = item.title;
                    const dateStr = isAd ? "" : (item as FeedItem).date;
                    const adPlan = isAd ? (item as PremiumAd).adPlan : (item as FeedItem).isAd ? (item as FeedItem).adPlan : undefined;
                    const stats = fakeStats(item.id);
                    const badgeLabel = adPlan === "premium" ? "프리미엄광고" : adPlan === "main" ? "직접광고" : adPlan === "basic" ? "광고" : null;
                    const badgeColor = adPlan === "premium" ? "bg-amber-400 text-amber-900" : adPlan === "main" ? "bg-pink-500 text-white" : "bg-gray-700 text-white";
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isAd) {
                            const ad = item as PremiumAd;
                            window.open(ad.url || `${BASE}/content/${ad.id}`, "_blank");
                          } else {
                            window.open(`/content/${item.id}`, "_blank", "noopener,noreferrer");
                          }
                        }}
                        className="shrink-0 w-44 cursor-pointer group"
                      >
                        <div className="relative h-28 rounded-xl overflow-hidden bg-gray-100 mb-2">
                          <img
                            src={thumbSrc}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {badgeLabel && (
                            <div className="absolute top-1.5 left-1.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-[12px] font-semibold text-gray-800 line-clamp-2 leading-snug mb-1">{title}</p>
                        {dateStr && <p className="text-[10px] text-gray-400 mb-1.5">{dateStr}</p>}
                        <div className="flex items-center gap-2.5 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{stats.likes}</span>
                          <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{stats.comments}</span>
                          <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{stats.views}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 📢 공동광고 지원센터 배너 (다크 네이비) */}
            {!isFiltered && (
              <Link
                href="/ad-submit"
                className="block mb-5 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-4 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wide">지역 소상공인을 위한</p>
                    <p className="text-lg font-extrabold text-white mb-1 leading-tight">공동광고 지원센터</p>
                    <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                      {bannerConfig?.subtitle ?? "하루 15,000원으로 강릉에 노출하세요!"}&nbsp;
                      현재 <span className="text-orange-400 font-bold">{bannerConfig?.stat1Value ?? "120건+"}</span> 광고가 PLAY강릉으로 고객을 만납니다.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex items-center gap-2 bg-slate-700/70 rounded-xl px-3 py-2">
                        <Megaphone className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <div className="leading-none">
                          <p className="text-white font-bold text-xs">{bannerConfig?.stat1Value ?? "120건+"}</p>
                          <p className="text-slate-400 text-[9px] mt-0.5">{bannerConfig?.stat1Label ?? "광고 신청"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-700/70 rounded-xl px-3 py-2">
                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <div className="leading-none">
                          <p className="text-white font-bold text-xs">{bannerConfig?.stat2Value ?? "55만명+"}</p>
                          <p className="text-slate-400 text-[9px] mt-0.5">{bannerConfig?.stat2Label ?? "SNS 평균 팔로워"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-700/70 rounded-xl px-3 py-2">
                        <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        <div className="leading-none">
                          <p className="text-white font-bold text-xs">{bannerConfig?.stat3Value ?? "10만명+"}</p>
                          <p className="text-slate-400 text-[9px] mt-0.5">{bannerConfig?.stat3Label ?? "월 방문자"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <Megaphone className="w-6 h-6 text-orange-400" />
                    </div>
                    <span className="bg-orange-500 hover:bg-orange-600 transition-colors text-white font-bold text-[11px] rounded-xl px-3 py-2 shadow-lg text-center leading-tight whitespace-nowrap">
                      지금 바로<br />시작하기 →
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* 🔥 인기 태그 (전체 탭 + 인기 태그 존재할 때) */}
            {!isFiltered && popularTags.length > 0 && (
              <section className="mb-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <Flame className="w-4 h-4 text-red-500 fill-red-400" />
                  <span className="text-sm font-bold text-gray-800">지금 강릉 인기 태그</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularTags.slice(0, 10).map((t) => (
                    <button
                      key={t.tag}
                      onClick={() => handleTagClick(t.tag)}
                      className="px-3 py-1.5 rounded-full text-sm bg-white border border-gray-200 text-gray-700 font-medium hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      {t.tag.startsWith("#") ? t.tag : `#${t.tag}`}
                      <span className="ml-1.5 text-xs text-gray-400">{t.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 검색 결과 카운트 */}
            {isSearching && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  {filteredFeed.length}건의 결과
                  <span className="ml-1 font-medium text-blue-600">· &ldquo;{searchQuery}&rdquo;</span>
                  <button onClick={clearSearch} className="ml-2 underline text-gray-400 hover:text-gray-600">초기화</button>
                </p>
              </div>
            )}

            {/* 오늘의행사 안내 */}
            {activeTag === "오늘의행사" && !isSearching && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 rounded-xl">
                <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700 font-medium">오늘 진행 중이거나 시작하는 행사만 표시됩니다.</p>
              </div>
            )}

            {/* 피드 그리드 */}
            {filteredFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Search className="w-12 h-12 mb-3 opacity-15" />
                <p className="text-base font-semibold text-gray-600">
                  {isSearching ? "검색 결과가 없습니다." : activeTag === "오늘의행사" ? "오늘 진행 중인 행사가 없습니다." : "아직 등록된 콘텐츠가 없습니다."}
                </p>
                <p className="text-sm mt-1 text-gray-400">다른 태그로 찾아보세요.</p>
                {isFiltered && (
                  <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={() => handleTagClick("전체")}>
                    전체 보기
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {display.map((item, idx) => (
                    <div key={item.id}>
                      <FeedCard item={item} onTagClick={(tag) => handleTagClick(tag)} />
                      {/* 피드 중간 공동광고 배너 (8개마다) */}
                      {(idx + 1) % 8 === 0 && idx < display.length - 1 && !isFiltered && (
                        <Link
                          href="/ad-submit"
                          className="col-span-2 sm:col-span-3 lg:col-span-4 mt-3 mb-1 block rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-white hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-white/80">📢 공동광고 모집중</p>
                              <p className="text-sm font-bold">하루 1만5천원부터 지역광고 참여</p>
                            </div>
                            <span className="text-xs font-semibold bg-white/20 rounded-lg px-3 py-1.5">참여하기 →</span>
                          </div>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
                {!showAll && filteredFeed.length > 12 && (
                  <div className="mt-6 text-center">
                    <Button variant="outline" size="lg" onClick={() => setShowAll(true)}>
                      더 보기 ({filteredFeed.length - 12}건)
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-500 py-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-[11px] leading-relaxed space-y-0.5">
          <p>
            상호 플레이강릉 · 대표자 손원길 · 사업자등록번호 292-07-03357
            <span className="mx-1.5 text-gray-700">|</span>
            <a href="mailto:event62@gmail.com" className="hover:text-gray-300 transition-colors">event62@gmail.com</a>
          </p>
          <p className="text-gray-600">
            강원특별자치도 강릉시 사천면 진리해변길 37 103-1101
            <span className="mx-1.5 text-gray-700">·</span>
            © 2026 PLAY강릉
            <Link href="/admin" className="ml-1 text-gray-900 select-none" tabIndex={-1} aria-hidden="true">·</Link>
          </p>
        </div>
      </footer>

      {/* 홈화면 추가 안내 모달 */}
      {installGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setInstallGuide(false)}>
          <div className="w-full max-w-sm bg-white rounded-t-2xl p-6 pb-10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <img src={`${BASE}/logo.png`} alt="" className="w-12 h-12 rounded-2xl object-contain bg-blue-50 p-1 border border-blue-100" />
              <div>
                <p className="font-bold text-gray-900 text-base">PLAY강릉 홈화면 추가</p>
                <p className="text-xs text-gray-500">앱처럼 바로 실행할 수 있습니다</p>
              </div>
            </div>
            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span><span>Safari 하단의 <strong>공유 버튼(□↑)</strong>을 누릅니다</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span><span>스크롤해서 <strong>"홈 화면에 추가"</strong>를 선택합니다</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span><span>오른쪽 위 <strong>"추가"</strong>를 누르면 완료!</span></li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span><span>Chrome 주소창 오른쪽 <strong>⋮ 메뉴</strong>를 누릅니다</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span><span><strong>"홈 화면에 추가"</strong> 또는 <strong>"앱 설치"</strong>를 선택합니다</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span><span><strong>"추가"</strong>를 누르면 홈화면에 아이콘이 생깁니다</span></li>
              </ol>
            )}
            <button onClick={() => setInstallGuide(false)} className="mt-6 w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
