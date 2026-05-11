import { Router } from "express";
import { readSources, addSource, deleteSource, toggleSource } from "../lib/sources.js";

const router = Router();

router.get("/sources", async (req, res) => {
  try {
    const sources = await readSources();
    res.json({ sources });
  } catch (err) {
    req.log.error({ err }, "소스 목록 조회 실패");
    res.status(500).json({ error: "소스 목록 조회 실패" });
  }
});

router.post("/sources", async (req, res) => {
  try {
    const { name, url } = req.body as { name?: string; url?: string };
    if (!name || !url) return res.status(400).json({ error: "name과 url은 필수입니다." });
    try { new URL(url); } catch { return res.status(400).json({ error: "유효하지 않은 URL입니다." }); }
    const source = await addSource(name.trim(), url.trim());
    req.log.info({ id: source.id, url }, "소스 추가");
    return res.json({ source });
  } catch (err) {
    req.log.error({ err }, "소스 추가 실패");
    return res.status(500).json({ error: "소스 추가 실패" });
  }
});

router.patch("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled 필드가 필요합니다." });
    const ok = await toggleSource(id, enabled);
    if (!ok) return res.status(404).json({ error: "소스를 찾을 수 없습니다." });
    req.log.info({ id, enabled }, "소스 상태 변경");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "소스 상태 변경 실패");
    return res.status(500).json({ error: "소스 상태 변경 실패" });
  }
});

router.delete("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await deleteSource(id);
    if (!ok) return res.status(404).json({ error: "소스를 찾을 수 없습니다." });
    req.log.info({ id }, "소스 삭제");
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "소스 삭제 실패");
    return res.status(500).json({ error: "소스 삭제 실패" });
  }
});

export default router;
