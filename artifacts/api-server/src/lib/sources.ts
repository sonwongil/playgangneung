import crypto from "crypto";
import { gcsReadJson, gcsWriteJson } from "./gcsJson.js";

const SOURCES_FILE = "data/sources.json";

export interface CrawlSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

const DEFAULT_SOURCES: CrawlSource[] = [
  { id: "gn_yeyak",    name: "강릉시 이달의 행사",   url: "https://www.gn.go.kr/yeyak/selectUnityEventWebList.do?key=6420",                                    enabled: true, createdAt: "2026-05-09T00:00:00.000Z" },
  { id: "gn_artscenter", name: "강릉아트센터",        url: "https://www.gn.go.kr/artscenter/selectMoonhwainList.do?key=5728&searchMoon_p_team=artCenter",       enabled: true, createdAt: "2026-05-09T00:00:00.000Z" },
  { id: "gncaf",       name: "강릉문화예술재단",      url: "https://www.gncaf.or.kr/ko/community/event",                                                        enabled: true, createdAt: "2026-05-09T00:00:00.000Z" },
  { id: "9a42b8e6c3d359503a479d3250dda15a", name: "강릉시청 공연/행사", url: "https://www.gn.go.kr/yeyak/selectMoonhwainList.do?key=6422",                    enabled: true, createdAt: "2026-05-11T04:32:53.800Z" },
  { id: "8413d48f68679f722eab58fdcb30a3be", name: "교육/강좌",          url: "https://www.gn.go.kr/yeyak/selectUnityProgrmWebList.do?key=5411&insttTy=URINTY01", enabled: true, createdAt: "2026-05-11T04:34:08.435Z" },
  { id: "524b0fccab03db8d4b7995f1e20117fa", name: "체험/견학",          url: "https://www.gn.go.kr/yeyak/selectUnityExprnWebList.do?key=5532",                 enabled: true, createdAt: "2026-05-11T04:35:33.835Z" },
  { id: "ecb2b83a9b991614f90adab5720c8833", name: "지원/접수",          url: "https://www.gn.go.kr/yeyak/selectUserOnlineReceptionList.do?key=5540",           enabled: true, createdAt: "2026-05-11T04:36:23.800Z" },
  { id: "7d5086e6b2186994dca3c80b58a00c72", name: "관광개발공사 행사안내", url: "https://www.gtdc.or.kr/pub/bbsevent.do",                                      enabled: true, createdAt: "2026-05-11T04:46:19.328Z" },
  { id: "935f6b9c823bb08808bae2d4c67dbb10", name: "강릉시립미술관",     url: "https://www.gn.go.kr/mu/selectMoonhwainList.do?key=6620&searchMoon_p_team=gnmu", enabled: true, createdAt: "2026-05-11T05:20:01.024Z" },
  { id: "513809de7c582cd13b472e5c0beee376", name: "강원일보-강릉",      url: "https://kwnews.co.kr/area/gangneung?area=W100000800003",                         enabled: true, createdAt: "2026-05-11T21:14:40.105Z" },
  { id: "74ce0078cc9b3362c4f7750d5fb7ea9d", name: "강원도민일보-강릉",  url: "https://cdn.kado.net/rss/gn_rss_allArticle.xml",                                 enabled: true, createdAt: "2026-05-11T21:15:49.188Z" },
];

export async function readSources(): Promise<CrawlSource[]> {
  const stored = await gcsReadJson<CrawlSource[] | null>(SOURCES_FILE, null);
  if (stored && stored.length > 0) return stored;
  await gcsWriteJson(SOURCES_FILE, DEFAULT_SOURCES);
  return DEFAULT_SOURCES;
}

export async function saveSources(sources: CrawlSource[]): Promise<void> {
  await gcsWriteJson(SOURCES_FILE, sources);
}

export async function addSource(name: string, url: string): Promise<CrawlSource> {
  const sources = await readSources();
  const source: CrawlSource = {
    id: crypto.createHash("md5").update(`source:${url}:${Date.now()}`).digest("hex"),
    name,
    url,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  sources.push(source);
  await saveSources(sources);
  return source;
}

export async function deleteSource(id: string): Promise<boolean> {
  const sources = await readSources();
  const filtered = sources.filter((s) => s.id !== id);
  if (filtered.length === sources.length) return false;
  await saveSources(filtered);
  return true;
}

export async function toggleSource(id: string, enabled: boolean): Promise<boolean> {
  const sources = await readSources();
  const source = sources.find((s) => s.id === id);
  if (!source) return false;
  source.enabled = enabled;
  await saveSources(sources);
  return true;
}
