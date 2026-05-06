import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import type { Ad } from "./ads.js";
import type { CrawledEvent } from "../lib/storage.js";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const ADS_FILE = path.join(DATA_DIR, "ads.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

const PLAN_DAYS: Record<string, number> = { basic: 3, main: 7, premium: 30 };
const PLAN_WEIGHT: Record<string, number> = { basic: 1, main: 3, premium: 5 };

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  date: string;
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

const CATEGORY_THUMBNAILS: Record<string, string> = {
  행사: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  맛집: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
  핫플: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  지역소식: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  기타: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
};

const MOCK_FEED_EVENTS: FeedItem[] = [
  { id: "mock-1", title: "2026 강릉 커피축제", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제.", date: "2026-05-10", link: "https://www.gangneung.go.kr", source: "강릉시청", category: "행사", thumbnail: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80", isAd: false },
  { id: "mock-2", title: "안목해변 카페거리 맛집 탐방", description: "강릉 안목해변 개성 넘치는 카페와 식당들.", date: "2026-05-08", link: "https://www.gangneung.go.kr", source: "강릉관광공사", category: "맛집", thumbnail: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80", isAd: false },
  { id: "mock-3", title: "경포해변 일출 명소", description: "강릉 경포해변에서 바라보는 아름다운 일출.", date: "2026-05-06", link: "https://www.gangneung.go.kr", source: "PLAY강릉", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", isAd: false },
  { id: "mock-4", title: "강릉 단오제 준비 위원회 출범", description: "유네스코 무형문화유산 강릉단오제 2026년 준비 시작.", date: "2026-05-01", link: "https://www.gangneung.go.kr", source: "강릉시청", category: "지역소식", thumbnail: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80", isAd: false },
  { id: "mock-5", title: "강릉 초당 순두부 골목", description: "동해 바닷물로 만든 부드럽고 담백한 순두부를 맛보세요.", date: "2026-05-03", link: "https://www.gangneung.go.kr", source: "강릉관광공사", category: "맛집", thumbnail: "https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=800&q=80", isAd: false },
  { id: "mock-6", title: "오죽헌 문화재 야간 개방", description: "신사임당과 율곡 이이의 생가, 오죽헌 특별 야간 문화 행사.", date: "2026-05-15", link: "https://www.gangneung.go.kr", source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80", isAd: false },
  { id: "mock-7", title: "강릉 바우길 트레킹", description: "동해 바다와 백두대간을 잇는 강릉 바우길 봄 트레킹.", date: "2026-05-12", link: "https://www.gangneung.go.kr", source: "강원도청", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", isAd: false },
  { id: "mock-8", title: "강릉 아트 페스타 2026", description: "강릉을 대표하는 예술 축제. 지역 예술가들의 작품 전시와 공연.", date: "2026-05-20", link: "https://www.gangneung.go.kr", source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80", isAd: false },
];

async function readAds(): Promise<Ad[]> {
  try {
    const raw = await fs.readFile(ADS_FILE, "utf-8");
    return JSON.parse(raw) as Ad[];
  } catch { return []; }
}

async function readEvents(): Promise<CrawledEvent[]> {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf-8");
    return JSON.parse(raw) as CrawledEvent[];
  } catch { return []; }
}

function isAdActive(ad: Ad): boolean {
  const approvedAt = (ad as Ad & { approvedAt?: string }).approvedAt;
  if (!approvedAt) return true;
  const days = PLAN_DAYS[ad.plan] ?? 3;
  const expiry = new Date(approvedAt).getTime() + days * 86400_000;
  return Date.now() < expiry;
}

function adToFeedItem(ad: Ad): FeedItem {
  const thumbnail = ad.imageUrl ?? CATEGORY_THUMBNAILS[ad.category] ?? CATEGORY_THUMBNAILS["기타"];
  return {
    id: `ad-${ad.id}`,
    title: ad.title,
    description: ad.description,
    date: ad.date || (ad as Ad & { approvedAt?: string }).approvedAt?.slice(0, 10) || "",
    link: ad.url || "",
    source: ad.businessName,
    category: ad.category,
    thumbnail,
    isAd: true,
    adPlan: ad.plan,
    adWeight: PLAN_WEIGHT[ad.plan] ?? 1,
    businessName: ad.businessName,
    location: ad.location,
  };
}

function eventToFeedItem(ev: CrawledEvent & { category?: string; thumbnail?: string }): FeedItem {
  const category = ev.category ?? "지역소식";
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    date: ev.date,
    link: ev.link,
    source: ev.source,
    category,
    thumbnail: ev.thumbnail ?? CATEGORY_THUMBNAILS[category] ?? null,
    isAd: false,
  };
}

router.get("/feed", async (req, res) => {
  try {
    const [rawAds, rawEvents] = await Promise.all([readAds(), readEvents()]);

    const activeAds = rawAds
      .filter((a) => ["approved", "scheduled", "published"].includes(a.status) && isAdActive(a))
      .map(adToFeedItem);

    const premiumAds = activeAds.filter((a) => a.adPlan === "premium");
    const mainAds    = activeAds.filter((a) => a.adPlan === "main");
    const basicAds   = activeAds.filter((a) => a.adPlan === "basic");

    const approvedReal = rawEvents
      .filter((e) => e.status === "approved")
      .map(eventToFeedItem)
      .sort((a, b) => b.date.localeCompare(a.date));

    const events: FeedItem[] = approvedReal.length >= 3 ? approvedReal : MOCK_FEED_EVENTS;

    const interleaved: FeedItem[] = [];
    let bi = 0;
    events.forEach((ev, idx) => {
      if (idx > 0 && idx % 3 === 0 && bi < basicAds.length) {
        interleaved.push(basicAds[bi++]);
      }
      interleaved.push(ev);
    });
    while (bi < basicAds.length) interleaved.push(basicAds[bi++]);

    const feed = [...premiumAds, ...mainAds, ...interleaved];

    return res.json({ feed, total: feed.length });
  } catch (err) {
    req.log.error({ err }, "피드 조회 실패");
    return res.status(500).json({ error: "피드 조회 실패" });
  }
});

export default router;
