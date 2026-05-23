import { Router } from "express";
import type { Ad } from "./ads.js";
import { readEvents, type CrawledEvent } from "../lib/storage.js";
import { detectCategory } from "../lib/dateParser.js";
import { db, adsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

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
  sourceUrl: string;
  source: string;
  category: string;
  thumbnail: string | null;
  videoUrl: string | null;
  location: string;
  isAd: boolean;
  adPlan?: "basic" | "main" | "premium";
  adWeight?: number;
  businessName?: string;
  phone?: string;
  email?: string;
  extraImages?: string[];
  hashtags?: string[];
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


async function readAds(): Promise<Ad[]> {
  try {
    const rows = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      businessName: row.businessName,
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      category: row.category,
      title: row.title,
      description: row.description,
      date: row.date,
      location: row.location,
      url: row.url,
      imageUrl: row.imageUrl ?? null,
      extraImages: (row.extraImages as string[] | null) ?? undefined,
      socialDraft: (row.socialDraft as Ad["socialDraft"]) ?? null,
      plan: (row.plan as Ad["plan"]) ?? "basic",
      status: (row.status as Ad["status"]) ?? "pending",
      source: "광고접수" as const,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString(),
      isFreeAd: true as const,
      aiScore: row.aiScore ?? null,
      aiNote: row.aiNote ?? null,
    }));
  } catch { return []; }
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
    sourceUrl: "",
    source: ad.businessName,
    category: ad.category,
    thumbnail,
    videoUrl: (ad as any).videoUrl ?? null,
    location: ad.location || "강릉",
    isAd: true,
    adPlan: ad.plan,
    adWeight: PLAN_WEIGHT[ad.plan] ?? 1,
    businessName: ad.businessName,
    phone: ad.phone || undefined,
    email: ad.email || undefined,
    extraImages: ad.extraImages && ad.extraImages.length > 0 ? ad.extraImages : undefined,
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
    sourceUrl: ev.link || "",
    source: ev.source,
    category,
    thumbnail: proxyThumbnail(ev.thumbnail),
    videoUrl: ev.videoUrl ?? null,
    location: ev.location || "강릉",
    isAd: false,
    hashtags: ev.hashtags ?? [],
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
        // ended 그룹은 최근 종료 먼저 (내림차순), 나머지는 가까운 날짜 먼저 (오름차순)
        if (a.scheduleStatus === "ended") return b.date.localeCompare(a.date);
        return a.date.localeCompare(b.date);
      });

    const events: FeedItem[] = approvedReal;

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
