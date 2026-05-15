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
