import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, ExternalLink, MapPin, Instagram, Facebook, Youtube } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Category = "전체" | "행사" | "맛집" | "핫플" | "지역소식";

interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  link: string;
  source: string;
  category?: string;
  thumbnail?: string;
  status?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  행사: "bg-blue-100 text-blue-700",
  맛집: "bg-orange-100 text-orange-700",
  핫플: "bg-pink-100 text-pink-700",
  지역소식: "bg-green-100 text-green-700",
};

const FALLBACK_EVENTS: EventItem[] = [
  { id: "f-1", title: "2026 강릉 커피축제", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제. 다양한 커피 체험과 전시, 공연을 즐겨보세요.", date: "2026-05-10", link: "https://www.gangneung.go.kr", source: "강릉시청", category: "행사", thumbnail: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80" },
  { id: "f-2", title: "안목해변 카페거리 맛집 탐방", description: "강릉 안목해변을 따라 즐비한 개성 넘치는 카페와 식당들을 소개합니다.", date: "2026-05-08", link: "https://www.gangneung.go.kr", source: "강릉관광공사", category: "맛집", thumbnail: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80" },
  { id: "f-3", title: "경포해변 일출 명소", description: "강릉 경포해변에서 바라보는 아름다운 일출. 한국의 대표적인 해돋이 명소를 소개합니다.", date: "2026-05-06", link: "https://www.gangneung.go.kr", source: "PLAY강릉", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80" },
  { id: "f-4", title: "강릉 단오제 준비 위원회 출범", description: "유네스코 무형문화유산에 등재된 강릉단오제의 2026년 행사 준비가 시작되었습니다.", date: "2026-05-01", link: "https://www.gangneung.go.kr", source: "강릉시청", category: "지역소식", thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80" },
  { id: "f-5", title: "강릉 초당 순두부 골목", description: "강릉의 대표 향토음식, 초당 순두부. 동해 바닷물로 만든 부드럽고 담백한 순두부를 맛보세요.", date: "2026-05-03", link: "https://www.gangneung.go.kr", source: "강릉관광공사", category: "맛집", thumbnail: "https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=800&q=80" },
  { id: "f-6", title: "오죽헌 문화재 야간 개방", description: "신사임당과 율곡 이이의 생가, 오죽헌에서 진행되는 특별 야간 문화 행사.", date: "2026-05-15", link: "https://www.gangneung.go.kr", source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80" },
  { id: "f-7", title: "강릉 바우길 트레킹", description: "동해 바다와 백두대간을 잇는 강릉 바우길. 봄 트레킹 코스를 소개합니다.", date: "2026-05-12", link: "https://www.gangneung.go.kr", source: "강원도청", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80" },
  { id: "f-8", title: "강릉 아트 페스타 2026", description: "강릉을 대표하는 예술 축제. 지역 예술가들의 작품 전시와 공연이 함께 펼쳐집니다.", date: "2026-05-20", link: "https://www.gangneung.go.kr", source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80" },
];

function EventCard({ event }: { event: EventItem }) {
  const category = event.category ?? "지역소식";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-700";
  const thumbnail = event.thumbnail ?? `https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80`;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
      <div className="relative overflow-hidden h-48">
        <img
          src={thumbnail}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {category}
          </span>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-base leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{event.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{event.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{event.source}</span>
          </div>
        </div>
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            자세히 보기 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Category>("전체");
  const [showAll, setShowAll] = useState(false);

  const { data } = useQuery<{ events: EventItem[]; total: number }>({
    queryKey: ["public-events"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/events`);
      if (!res.ok) throw new Error("이벤트 로드 실패");
      return res.json();
    },
    staleTime: 60_000,
  });

  const allEvents = data?.events?.length ? data.events : FALLBACK_EVENTS;

  const filtered =
    activeTab === "전체" ? allEvents : allEvents.filter((e) => e.category === activeTab);

  const display = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center" style={{ height: 50 }}>
          <a href={`${BASE}/`} className="inline-flex items-center">
            <img
              src={`${BASE}/logo2.png`}
              alt="PLAY강릉"
              style={{ height: 50, width: "auto" }}
            />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1),_transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-8 md:py-12 text-center">
          <p className="text-blue-200 text-sm font-medium tracking-widest uppercase mb-3">강릉의 모든 소식</p>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
            강릉을 더 즐겁게,<br className="md:hidden" /> PLAY강릉
          </h1>
          <p className="text-blue-100 text-base md:text-lg max-w-xl mx-auto">
            강릉의 행사, 맛집, 핫플, 지역소식을 한눈에 만나보세요.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-4 w-full">
        {/* Category Tabs */}
        <div className="mb-4">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as Category); setShowAll(false); }}>
            <TabsList className="bg-white border border-border shadow-sm h-auto p-1 gap-1">
              {(["전체", "행사", "맛집", "핫플", "지역소식"] as Category[]).map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-md"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <p className="text-lg">해당 카테고리의 콘텐츠가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {display.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {!showAll && filtered.length > 6 && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="lg" onClick={() => setShowAll(true)}>
              더 보기 ({filtered.length - 6}건)
            </Button>
          </div>
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
