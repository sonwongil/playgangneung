import crypto from "crypto";
import { logger } from "./logger.js";

const NAVER_API_BASE = "https://openapi.naver.com/v1/search/blog";

export interface NaverBlogItem {
  id: string;
  title: string;
  body: string;
  images: string[];
  sourceUrl: string;
  author: string;
  tags: string[];
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function blogItemId(link: string): string {
  return crypto.createHash("md5").update(`naver:${link}`).digest("hex").slice(0, 16);
}

function parsePostdate(postdate: string): Date | null {
  if (!postdate || postdate.length < 8) return null;
  const y = parseInt(postdate.slice(0, 4), 10);
  const m = parseInt(postdate.slice(4, 6), 10) - 1;
  const d = parseInt(postdate.slice(6, 8), 10);
  const dt = new Date(y, m, d);
  return isNaN(dt.getTime()) ? null : dt;
}

export async function searchNaverBlog(opts: {
  query: string;
  display?: number;
  start?: number;
  sort?: "sim" | "date";
  sinceDate?: Date;
}): Promise<{ items: NaverBlogItem[]; total: number; error?: string }> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { items: [], total: 0, error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정" };
  }

  const url = new URL(NAVER_API_BASE);
  url.searchParams.set("query", opts.query);
  url.searchParams.set("display", String(Math.min(opts.display ?? 30, 100)));
  url.searchParams.set("start", String(opts.start ?? 1));
  url.searchParams.set("sort", opts.sort ?? "date");

  const resp = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    logger.warn({ status: resp.status, body: errText.slice(0, 300) }, "네이버 블로그 검색 API 실패");
    return { items: [], total: 0, error: `네이버 API 오류 (${resp.status})` };
  }

  const data = await resp.json() as {
    total?: number;
    items?: Array<{
      title?: string;
      link?: string;
      description?: string;
      bloggername?: string;
      postdate?: string;
    }>;
  };

  const total = data.total ?? 0;
  const sinceDate = opts.sinceDate ?? null;

  const items: NaverBlogItem[] = (data.items ?? [])
    .filter((item) => {
      if (!sinceDate) return true;
      const dt = parsePostdate(item.postdate ?? "");
      if (!dt) return true;
      return dt >= sinceDate;
    })
    .map((item) => {
      const link = item.link ?? "";
      const title = stripHtml(item.title ?? "");
      const desc = stripHtml(item.description ?? "").slice(0, 500);
      const author = item.bloggername ?? "";
      const postdate = item.postdate ?? "";
      const year = postdate.slice(0, 4);

      return {
        id: blogItemId(link),
        title,
        body: desc,
        images: [],
        sourceUrl: link,
        author,
        tags: ["강릉", "블로그", year].filter(Boolean),
      };
    });

  return { items, total };
}
