import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import type { Ad } from "./ads.js";
import type { CrawledEvent } from "../lib/storage.js";
import { detectCategory } from "../lib/dateParser.js";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const ADS_FILE = path.join(DATA_DIR, "ads.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

const PLAN_DAYS: Record<string, number> = { basic: 1, main: 3, premium: 5 };
const PLAN_WEIGHT: Record<string, number> = { basic: 1, main: 3, premium: 5 };

export interface FeedItem {
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
  location: string;
  isAd: boolean;
  adPlan?: "basic" | "main" | "premium";
  adWeight?: number;
  businessName?: string;
}

const CATEGORY_THUMBNAILS: Record<string, string> = {
  행사: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  맛집: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
  핫플: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  지역소식: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80",
  기타: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
};

const SITE_URL = process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app";

const PROXY_HOSTS = ["www.gn.go.kr", "gn.go.kr", "gn.moonhwain.net", "www.gncaf.or.kr", "gncaf.or.kr"];

function proxyThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    if (PROXY_HOSTS.includes(hostname)) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
  } catch { /* noop */ }
  return url;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const MOCK_FEED_EVENTS: FeedItem[] = [
  { id: "mock-1", title: "2026 강릉 커피축제", description: "세계적인 커피 도시 강릉에서 펼쳐지는 커피 축제.", date: "2026-05-10", startDate: "2026-05-10", endDate: "2026-05-12", scheduleStatus: "upcoming", link: `${SITE_URL}/content/mock-1`, source: "강릉시청", category: "행사", thumbnail: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80", location: "경포 일원", isAd: false },
  { id: "mock-2", title: "안목해변 카페거리 맛집 탐방", description: "강릉 안목해변 개성 넘치는 카페와 식당들.", date: "2026-05-08", startDate: "2026-05-08", endDate: "", scheduleStatus: "upcoming", link: `${SITE_URL}/content/mock-2`, source: "강릉관광공사", category: "맛집", thumbnail: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80", location: "안목해변로", isAd: false },
  { id: "mock-3", title: "경포해변 일출 명소", description: "강릉 경포해변에서 바라보는 아름다운 일출.", date: "2026-05-06", startDate: "2026-05-06", endDate: "", scheduleStatus: "today", link: `${SITE_URL}/content/mock-3`, source: "PLAY강릉", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", location: "경포해변", isAd: false },
  { id: "mock-6", title: "오죽헌 문화재 야간 개방", description: "신사임당과 율곡 이이의 생가, 오죽헌 특별 야간 문화 행사.", date: "2026-05-15", startDate: "2026-05-15", endDate: "2026-05-17", scheduleStatus: "upcoming", link: `${SITE_URL}/content/mock-6`, source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80", location: "오죽헌시립박물관", isAd: false },
  { id: "mock-7", title: "강릉 바우길 트레킹", description: "동해 바다와 백두대간을 잇는 강릉 바우길 봄 트레킹.", date: "2026-05-12", startDate: "2026-05-12", endDate: "", scheduleStatus: "upcoming", link: `${SITE_URL}/content/mock-7`, source: "강릉시청", category: "핫플", thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", location: "바우길 1코스", isAd: false },
  { id: "mock-8", title: "강릉 아트 페스타 2026", description: "강릉을 대표하는 예술 축제. 지역 예술가들의 작품 전시와 공연.", date: "2026-05-20", startDate: "2026-05-20", endDate: "2026-05-25", scheduleStatus: "upcoming", link: `${SITE_URL}/content/mock-8`, source: "강릉문화재단", category: "행사", thumbnail: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&q=80", location: "강릉문화예술관", isAd: false },
];

async function readAds(): Promise<Ad[]> {
  try { return JSON.parse(await fs.readFile(ADS_FILE, "utf-8")) as Ad[]; }
  catch { return []; }
}

async function readEvents(): Promise<CrawledEvent[]> {
  try { return JSON.parse(await fs.readFile(EVENTS_FILE, "utf-8")) as CrawledEvent[]; }
  catch { return []; }
}

function isAdActive(ad: Ad): boolean {
  const approvedAt = (ad as Ad & { approvedAt?: string }).approvedAt;
  if (!approvedAt) return true;
  const days = PLAN_DAYS[ad.plan] ?? 3;
  return Date.now() < new Date(approvedAt).getTime() + days * 86400_000;
}

function adToFeedItem(ad: Ad): FeedItem {
  const thumbnail = ad.imageUrl ?? CATEGORY_THUMBNAILS[ad.category] ?? CATEGORY_THUMBNAILS["기타"];
  return {
    id: `ad-${ad.id}`,
    title: ad.title,
    description: ad.description,
    date: ad.date || (ad as Ad & { approvedAt?: string }).approvedAt?.slice(0, 10) || "",
    startDate: ad.date || "",
    endDate: "",
    scheduleStatus: "upcoming",
    link: ad.url || "",
    source: ad.businessName,
    category: ad.category,
    thumbnail,
    location: ad.location || "강릉",
    isAd: true,
    adPlan: ad.plan,
    adWeight: PLAN_WEIGHT[ad.plan] ?? 1,
    businessName: ad.businessName,
  };
}

const SCHEDULE_ORDER: Record<string, number> = {
  today: 0, ongoing: 1, tomorrow: 2, upcoming: 3, dateUnknown: 4, ended: 5,
};

function eventToFeedItem(ev: CrawledEvent): FeedItem {
  const category = ev.category || detectCategory(ev.title, ev.description) || "지역소식";
  const today = todayStr();
  const tomorrow = tomorrowStr();

  // scheduleStatus 재계산 (저장된 값 우선, 없으면 실시간 계산)
  let scheduleStatus = ev.scheduleStatus || "upcoming";
  if (ev.startDate) {
    const end = ev.endDate || ev.startDate;
    if (ev.startDate === today && (!ev.endDate || ev.endDate === today)) scheduleStatus = "today";
    else if (ev.startDate === tomorrow && (!ev.endDate || ev.endDate === tomorrow)) scheduleStatus = "tomorrow";
    else if (ev.startDate > tomorrow) scheduleStatus = "upcoming";
    else if (end < today) scheduleStatus = "ended";
    else scheduleStatus = "ongoing";
  }

  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    date: ev.startDate || ev.date,
    startDate: ev.startDate || ev.date,
    endDate: ev.endDate || "",
    scheduleStatus,
    link: `${SITE_URL}/content/${ev.id}`,
    source: ev.source,
    category,
    thumbnail: proxyThumbnail(ev.thumbnail) ?? CATEGORY_THUMBNAILS[category] ?? null,
    location: ev.location || "강릉",
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

    // approved + published 이벤트 모두 포함
    const approvedReal = rawEvents
      .filter((e) => e.status === "approved" || e.status === "published")
      .map(eventToFeedItem)
      .sort((a, b) => {
        const sa = SCHEDULE_ORDER[a.scheduleStatus] ?? 4;
        const sb = SCHEDULE_ORDER[b.scheduleStatus] ?? 4;
        if (sa !== sb) return sa - sb;
        return a.date.localeCompare(b.date);
      });

    const events: FeedItem[] = approvedReal.length >= 3 ? approvedReal : MOCK_FEED_EVENTS;

    // basic 광고를 3개마다 하나씩 interleave
    const interleaved: FeedItem[] = [];
    let bi = 0;
    events.forEach((ev, idx) => {
      if (idx > 0 && idx % 3 === 0 && bi < basicAds.length) interleaved.push(basicAds[bi++]);
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
