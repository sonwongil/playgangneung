import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SOURCES_FILE = path.join(DATA_DIR, "sources.json");

export interface CrawlSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

const DEFAULT_SOURCES: CrawlSource[] = [
  {
    id: "gn_yeyak",
    name: "강릉시 이달의 행사",
    url: "https://www.gn.go.kr/yeyak/selectUnityEventWebList.do?key=6420",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "gn_artscenter",
    name: "강릉아트센터",
    url: "https://www.gn.go.kr/artscenter/selectMoonhwainList.do?key=5728&searchMoon_p_team=artCenter",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "gncaf",
    name: "강릉문화예술재단",
    url: "https://www.gncaf.or.kr/ko/community/event",
    enabled: true,
    createdAt: new Date().toISOString(),
  },
];

export async function readSources(): Promise<CrawlSource[]> {
  try {
    const raw = await fs.readFile(SOURCES_FILE, "utf-8");
    return JSON.parse(raw) as CrawlSource[];
  } catch {
    await saveSources(DEFAULT_SOURCES);
    return DEFAULT_SOURCES;
  }
}

export async function saveSources(sources: CrawlSource[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2), "utf-8");
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
