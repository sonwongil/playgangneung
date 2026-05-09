import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, ExternalLink, MapPin, Instagram, Facebook, Youtube,
  Megaphone, Star, Pin, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Category = "전체" | "행사" | "맛집" | "핫플" | "지역소식";
type EventSubTab = "전체" | "달력" | "오늘" | "내일" | "이번 주";

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
const TOMORROW_STR = getRelativeDate(1);

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
  const isTomorrow = item.date === TOMORROW_STR;

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
          {isTomorrow && !item.isAd && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500 text-white">
              내일
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

function EventCalendar({
  events,
  selectedDate,
  onSelectDate,
}: {
  events: FeedItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const todayDate = new Date();
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const eventDates = useMemo(
    () => new Set(events.map((e) => e.date)),
    [events]
  );

  const firstDayOfMonth = new Date(year, month, 1);
  const startDow = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const todayStr = todayDate.toISOString().slice(0, 10);

  function toDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const eventsForSelected = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : [];

  return (
    <div className="mb-4">
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold">{year}년 {month + 1}월</span>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {dayNames.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-semibold py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const dateStr = toDateStr(day);
            const isToday = dateStr === todayStr;
            const hasEvent = eventDates.has(dateStr);
            const isSelected = dateStr === selectedDate;
            const dow = (startDow + day - 1) % 7;

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center justify-center w-full py-1.5 rounded-lg text-xs transition-all
                  ${isSelected
                    ? "bg-blue-600 text-white font-bold shadow"
                    : isToday
                    ? "bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-300"
                    : dow === 0
                    ? "text-red-500 hover:bg-red-50"
                    : dow === 6
                    ? "text-blue-500 hover:bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                {day}
                {hasEvent && (
                  <span
                    className={`mt-0.5 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground px-1 mb-2 font-medium">
            {selectedDate} 행사 {eventsForSelected.length}건
          </p>
          {eventsForSelected.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">이 날 예정된 행사가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {eventsForSelected.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const VALID_CATEGORIES: Category[] = ["전체", "행사", "맛집", "핫플", "지역소식"];

function parseCategoryParam(search: string): Category {
  const params = new URLSearchParams(search);
  const cat = params.get("category");
  if (cat && VALID_CATEGORIES.includes(cat as Category)) return cat as Category;
  return "전체";
}

export default function Home() {
  const search = useSearch();
  const [, navigate] = useLocation();

  const initialCategory = useMemo(() => parseCategoryParam(search), []);
  const [activeTab, setActiveTab] = useState<Category>(initialCategory);
  const [eventSubTab, setEventSubTab] = useState<EventSubTab>("전체");
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const cat = parseCategoryParam(search);
    if (cat !== activeTab) {
      setActiveTab(cat);
      setEventSubTab("전체");
      setCalendarDate(null);
      setShowAll(false);
    }
  }, [search]);

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

  const weekRange = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
  }, []);

  const categoryFiltered = useMemo(
    () =>
      activeTab === "전체"
        ? allItems
        : allItems.filter((item) => item.category === activeTab),
    [allItems, activeTab]
  );

  const eventItems = useMemo(
    () => allItems.filter((i) => i.category === "행사"),
    [allItems]
  );

  const subFiltered = useMemo(() => {
    if (activeTab !== "행사" || eventSubTab === "달력") return categoryFiltered;
    switch (eventSubTab) {
      case "오늘": return categoryFiltered.filter((i) => i.date === TODAY_STR);
      case "내일": return categoryFiltered.filter((i) => i.date === TOMORROW_STR);
      case "이번 주": return categoryFiltered.filter((i) => i.date >= weekRange.start && i.date <= weekRange.end);
      default: return categoryFiltered;
    }
  }, [categoryFiltered, activeTab, eventSubTab, weekRange]);

  const display = showAll ? subFiltered : subFiltered.slice(0, 6);
  const adCount = allItems.filter((i) => i.isAd).length;

  const todayEventCount = eventItems.filter((i) => i.date === TODAY_STR).length;
  const tomorrowEventCount = eventItems.filter((i) => i.date === TOMORROW_STR).length;
  const weekEventCount = eventItems.filter(
    (i) => i.date >= weekRange.start && i.date <= weekRange.end
  ).length;

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { 전체: allItems.length, 행사: 0, 맛집: 0, 핫플: 0, 지역소식: 0 };
    for (const item of allItems) {
      if (item.category in counts) counts[item.category as Category]++;
    }
    return counts;
  }, [allItems]);

  function handleMainTabChange(v: string) {
    const cat = v as Category;
    setActiveTab(cat);
    setEventSubTab("전체");
    setCalendarDate(null);
    setShowAll(false);
    if (cat === "전체") {
      navigate("/");
    } else {
      navigate(`/?category=${encodeURIComponent(cat)}`);
    }
  }

  function handleSubTabChange(sub: EventSubTab) {
    setEventSubTab(sub);
    if (sub !== "달력") setCalendarDate(null);
    setShowAll(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center" style={{ height: 50 }}>
          <a href={`${BASE}/`} className="inline-flex items-center">
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 50, width: "auto" }} />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-blue-200 text-sm font-medium tracking-widest uppercase mb-2">강릉의 모든 소식</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight text-center">
            <span className="block">강릉을 더 즐겁게,</span>
            <span className="block">PLAY강릉</span>
          </h1>
          <p className="text-blue-100 text-sm md:text-base max-w-xl mx-auto">
            강릉의 행사, 맛집, 핫플, 지역소식을 한눈에 만나보세요.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-4 w-full">
        {/* Category Tabs */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-2 w-full">
            <Tabs value={activeTab} onValueChange={handleMainTabChange}>
              <TabsList className="bg-white border border-border shadow-sm h-8 p-0.5 gap-0.5">
                {(["전체", "행사", "지역소식", "맛집", "핫플"] as Category[]).map((cat) => {
                  const isEmpty = cat !== "전체" && categoryCounts[cat] === 0;
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className={`px-3 py-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-white rounded flex items-center gap-1 ${isEmpty ? "opacity-40" : ""}`}
                    >
                      {cat}
                      {isEmpty ? (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-gray-100 text-gray-400 leading-none">준비중</span>
                      ) : categoryCounts[cat] > 0 ? (
                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full leading-none
                          ${activeTab === cat
                            ? "bg-white/25 text-white"
                            : "bg-gray-100 text-gray-500"
                          }`}>
                          {categoryCounts[cat]}
                        </span>
                      ) : null}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              {adCount > 0 && (
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                  <Megaphone className="w-3 h-3 mr-1" />{adCount}건
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 font-semibold gap-1"
                onClick={() => { window.location.href = `${BASE}/ad-submit`; }}
              >
                <Megaphone className="w-3 h-3" /> 광고접수
              </Button>
            </div>
          </div>
        </div>

        {/* Event Sub-Tabs — Instagram filter pill style */}
        {activeTab === "행사" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "전체" as EventSubTab, label: "전체", count: eventItems.length },
              { key: "달력" as EventSubTab, label: "📅 행사달력", count: null },
              { key: "오늘" as EventSubTab, label: "오늘", count: todayEventCount },
              { key: "내일" as EventSubTab, label: "내일", count: tomorrowEventCount },
              { key: "이번 주" as EventSubTab, label: "이번 주", count: weekEventCount },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => handleSubTabChange(key)}
                className={`shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border
                  ${eventSubTab === key
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-105"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
              >
                {label}
                {count !== null && (
                  <span className={`ml-0.5 text-[10px] font-bold px-1 py-0.5 rounded-full
                    ${eventSubTab === key ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Calendar View */}
        {activeTab === "행사" && eventSubTab === "달력" && (
          <EventCalendar
            events={eventItems}
            selectedDate={calendarDate}
            onSelectDate={setCalendarDate}
          />
        )}

        {/* Cards Grid */}
        {!(activeTab === "행사" && eventSubTab === "달력") && (
          <>
            {subFiltered.length === 0 ? (
              activeTab !== "전체" && categoryCounts[activeTab] === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <RefreshCw className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-lg font-semibold text-gray-600">곧 업데이트됩니다</p>
                  <p className="text-sm mt-1 text-gray-400">{activeTab} 카테고리 콘텐츠를 준비 중입니다.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs"
                    onClick={() => handleMainTabChange("전체")}
                  >
                    전체 콘텐츠 보기
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-lg font-medium">해당 날짜의 행사가 없습니다.</p>
                  <p className="text-sm mt-1">다른 날짜를 선택하거나 전체 탭을 확인해보세요.</p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {display.map((item) => (
                  <FeedCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {!showAll && subFiltered.length > 6 && (
              <div className="mt-8 text-center">
                <Button variant="outline" size="lg" onClick={() => setShowAll(true)}>
                  더 보기 ({subFiltered.length - 6}건)
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* SNS Section */}
      <section className="bg-white border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold mb-2">SNS에서 PLAY강릉 팔로우</h2>
          <p className="text-muted-foreground text-sm mb-6">최신 강릉 소식을 SNS에서 가장 먼저 만나보세요.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Instagram className="w-4 h-4" />인스타그램
            </a>
            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Facebook className="w-4 h-4" />페이스북
            </a>
            <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:opacity-90 transition-opacity">
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
