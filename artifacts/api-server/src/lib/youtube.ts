import { logger } from "./logger.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeVideoInfo {
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  description: string;
  embeddable: boolean;
  viewCount: number | null;
}

function extractYoutubeId(input: string): string {
  const trimmed = input.trim();
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0];
    if (u.searchParams.get("v")) return u.searchParams.get("v")!;
    const shortMatch = u.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortMatch) return shortMatch[1];
    const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
  } catch {
    // not a URL — treat as raw ID
  }
  return trimmed;
}

export async function fetchYoutubeInfo(rawInput: string): Promise<YoutubeVideoInfo | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const videoId = extractYoutubeId(rawInput);
  if (!videoId) return null;

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", videoId);
  url.searchParams.set("part", "snippet,status,statistics");

  const resp = await fetch(url.toString());
  if (!resp.ok) return null;

  const data = await resp.json() as {
    items?: Array<{
      snippet?: {
        title?: string;
        channelTitle?: string;
        description?: string;
        thumbnails?: {
          maxres?: { url: string };
          high?: { url: string };
          medium?: { url: string };
          default?: { url: string };
        };
      };
      status?: { embeddable?: boolean };
      statistics?: { viewCount?: string };
    }>;
  };

  const item = data.items?.[0];
  if (!item) return null;

  const snippet = item.snippet ?? {};
  const thumbnails = snippet.thumbnails ?? {};
  const thumbnailUrl =
    thumbnails.maxres?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  const viewCountRaw = item.statistics?.viewCount;
  const viewCount = viewCountRaw != null ? parseInt(viewCountRaw, 10) : null;

  return {
    youtubeId: videoId,
    title: snippet.title ?? "",
    channelName: snippet.channelTitle ?? "",
    thumbnailUrl,
    description: snippet.description ?? "",
    embeddable: item.status?.embeddable ?? true,
    viewCount: isNaN(viewCount as number) ? null : viewCount,
  };
}

// ─── YouTube 크롤링 (검색 / 채널) ────────────────────────────────────────────

interface YTSearchItem {
  id?: { videoId?: string };
}

interface YTVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: {
      maxres?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  status?: { embeddable?: boolean };
  statistics?: { viewCount?: string };
}

async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<YoutubeVideoInfo[]> {
  if (videoIds.length === 0) return [];
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("part", "snippet,status,statistics");

  const resp = await fetch(url.toString());
  if (!resp.ok) return [];
  const data = await resp.json() as { items?: YTVideoItem[] };

  return (data.items ?? []).map((item) => {
    const snippet = item.snippet ?? {};
    const thumbnails = snippet.thumbnails ?? {};
    const vid = item.id ?? "";
    const thumbnailUrl =
      thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ??
      thumbnails.default?.url ?? `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
    const viewCountRaw = item.statistics?.viewCount;
    const viewCount = viewCountRaw != null ? parseInt(viewCountRaw, 10) : null;
    return {
      youtubeId: vid,
      title: snippet.title ?? "",
      channelName: snippet.channelTitle ?? "",
      thumbnailUrl,
      description: (snippet.description ?? "").slice(0, 500),
      embeddable: item.status?.embeddable ?? true,
      viewCount: !isNaN(viewCount as number) ? viewCount : null,
    };
  });
}

export async function crawlYoutubeVideos(opts: {
  query?: string;
  channelId?: string;
  maxResults?: number;
  sinceDate?: Date;
}): Promise<{ videos: YoutubeVideoInfo[]; error?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { videos: [], error: "YOUTUBE_API_KEY 미설정" };

  const maxResults = Math.min(opts.maxResults ?? 50, 50);
  const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "id");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("relevanceLanguage", "ko");
  searchUrl.searchParams.set("regionCode", "KR");
  if (opts.sinceDate) {
    searchUrl.searchParams.set("publishedAfter", opts.sinceDate.toISOString());
  }

  if (opts.channelId) {
    searchUrl.searchParams.set("channelId", opts.channelId);
  } else {
    searchUrl.searchParams.set("q", opts.query ?? "강릉");
  }

  const resp = await fetch(searchUrl.toString());
  if (!resp.ok) {
    const errText = await resp.text();
    logger.warn({ status: resp.status, body: errText.slice(0, 200) }, "YouTube search 실패");
    return { videos: [], error: `YouTube API 오류 (${resp.status})` };
  }
  const data = await resp.json() as { items?: YTSearchItem[] };
  const videoIds = (data.items ?? [])
    .map((it) => it.id?.videoId ?? "")
    .filter(Boolean);

  if (videoIds.length === 0) return { videos: [] };
  const details = await fetchVideoDetails(videoIds, apiKey);
  return { videos: details };
}
