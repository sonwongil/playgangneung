import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../../../data/banner-config.json");

export interface BannerConfig {
  subtitle: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  stat3Label: string;
  stat3Value: string;
  ctaText: string;
}

const DEFAULT_CONFIG: BannerConfig = {
  subtitle: "하루 15,000원으로 강릉에 노출하세요!",
  stat1Label: "광고 신청",
  stat1Value: "누적 120건+",
  stat2Label: "PLAY강릉 팔로워",
  stat2Value: "55만명+",
  stat3Label: "월 방문자",
  stat3Value: "10만명+",
  ctaText: "지금 바로 시작하세요!",
};

async function readConfig(): Promise<BannerConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

router.get("/banner-config", async (_req, res) => {
  try {
    const config = await readConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: "설정 조회 실패" });
  }
});

router.patch("/banner-config", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "인증 필요" });
  try {
    const current = await readConfig();
    const updated: BannerConfig = { ...current, ...(req.body as Partial<BannerConfig>) };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "배너 설정 저장 실패");
    return res.status(500).json({ error: "설정 저장 실패" });
  }
});

export default router;
