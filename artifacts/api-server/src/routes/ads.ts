import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const ADS_FILE = path.join(DATA_DIR, "ads.json");

export type AdStatus = "pending" | "approved" | "scheduled" | "published" | "rejected";
export type AdPlan = "basic" | "main" | "premium";

export interface Ad {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  title: string;
  description: string;
  date: string;
  location: string;
  url: string;
  imageUrl: string | null;
  plan: AdPlan;
  status: AdStatus;
  source: "광고접수";
  createdAt: string;
  isFreeAd: true;
}

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

async function readAds(): Promise<Ad[]> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(ADS_FILE, "utf-8");
    return JSON.parse(raw) as Ad[];
  } catch {
    return [];
  }
}

async function saveAds(ads: Ad[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(ADS_FILE, JSON.stringify(ads, null, 2), "utf-8");
}

router.get("/ads", async (req, res) => {
  try {
    const ads = await readAds();
    return res.json({ ads, total: ads.length });
  } catch (err) {
    req.log.error({ err }, "ads 조회 실패");
    return res.status(500).json({ error: "조회 실패" });
  }
});

router.post("/ads", async (req, res) => {
  try {
    const body = req.body as Partial<Ad>;
    const ad: Ad = {
      id: crypto.randomUUID(),
      businessName: body.businessName ?? "",
      contactName: body.contactName ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      category: body.category ?? "기타",
      title: body.title ?? "",
      description: body.description ?? "",
      date: body.date ?? "",
      location: body.location ?? "",
      url: body.url ?? "",
      imageUrl: body.imageUrl ?? null,
      plan: body.plan ?? "basic",
      status: "pending",
      source: "광고접수",
      createdAt: new Date().toISOString(),
      isFreeAd: true,
    };
    const ads = await readAds();
    ads.unshift(ad);
    await saveAds(ads);
    req.log.info({ id: ad.id }, "광고 접수 완료");
    return res.status(201).json({ success: true, ad });
  } catch (err) {
    req.log.error({ err }, "광고 접수 실패");
    return res.status(500).json({ error: "접수 실패" });
  }
});

router.patch("/ads/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: AdStatus };
    const ads = await readAds();
    const idx = ads.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    ads[idx] = { ...ads[idx], status };
    await saveAds(ads);
    return res.json({ success: true, ad: ads[idx] });
  } catch (err) {
    req.log.error({ err }, "광고 상태 변경 실패");
    return res.status(500).json({ error: "상태 변경 실패" });
  }
});

router.delete("/ads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ads = await readAds();
    const filtered = ads.filter((a) => a.id !== id);
    if (filtered.length === ads.length) return res.status(404).json({ error: "광고를 찾을 수 없습니다" });
    await saveAds(filtered);
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "광고 삭제 실패");
    return res.status(500).json({ error: "삭제 실패" });
  }
});

export default router;
