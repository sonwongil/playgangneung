import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "../../../data/joint-ad-modal.json");

export interface JointAdModalConfig {
  subtitle: string;
  title: string;
  body: string;
  highlightTitle: string;
  highlightBody: string;
  footerText: string;
}

const DEFAULT_CONFIG: JointAdModalConfig = {
  subtitle: "지역 소상공인을 위한",
  title: "공동광고 지원센터 안내",
  body: "혼자 광고를 진행하면 적은 예산으로는 충분한 노출과 광고 최적화가 어려울 수 있습니다. 예를 들어 3만원의 광고비로 단독 광고를 진행하면 짧은 기간 동안 제한된 사용자에게만 노출될 수 있지만, 여러 업체가 함께 참여하는 공동광고는 더 큰 규모의 광고 캠페인으로 운영되어 보다 안정적이고 지속적인 노출 기회를 만들 수 있습니다.\n\n카페, 음식점, 숙박업, 체험시설, 공연, 행사 등 강릉을 알리고 싶은 누구나 참여할 수 있습니다.\n\n광고는 참여 업체별로 공정하게 운영되며, 광고 성과 향상을 위해 지속적으로 관리됩니다.",
  highlightTitle: "PLAY강릉 공동광고란?",
  highlightBody: "여러 참여 업체의 광고를 함께 운영하여 강릉 지역의 잠재 고객에게 효율적으로 홍보할 수 있도록 지원합니다. 광고 운영 경험이 없어도 신청만 하면 광고 제작과 집행을 지원받을 수 있습니다.",
  footerText: "아래 내용을 확인하신 후 광고 신청을 진행해 주세요.",
};

async function readConfig(): Promise<JointAdModalConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

router.get("/joint-ad-modal", async (_req, res) => {
  try {
    const config = await readConfig();
    res.json(config);
  } catch {
    res.status(500).json({ error: "설정 조회 실패" });
  }
});

router.patch("/joint-ad-modal", async (req, res) => {
  if (!req.session?.isAdmin) return res.status(401).json({ error: "인증 필요" });
  try {
    const current = await readConfig();
    const updated: JointAdModalConfig = {
      ...current,
      ...(req.body as Partial<JointAdModalConfig>),
    };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "공동광고 모달 설정 저장 실패");
    return res.status(500).json({ error: "설정 저장 실패" });
  }
});

export default router;
