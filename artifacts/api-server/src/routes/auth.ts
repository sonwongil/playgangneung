import { Router } from "express";
import { verifyPassword, changePassword, generateAdminToken, verifyAdminToken } from "../lib/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ error: "비밀번호를 입력하세요" });
    return;
  }
  const ok = await verifyPassword(password);
  if (!ok) {
    res.status(401).json({ error: "비밀번호가 올바르지 않습니다" });
    return;
  }
  req.session!.isAdmin = true;
  // iframe/크로스-오리진 환경을 위해 Bearer 토큰도 함께 반환
  res.json({ ok: true, token: generateAdminToken() });
});

router.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  const isCookie = req.session?.isAdmin === true;
  const auth = req.headers["authorization"];
  const isBearer = typeof auth === "string" && auth.startsWith("Bearer ") && verifyAdminToken(auth.slice(7));
  const isAdmin = isCookie || isBearer;
  res.json({ isAdmin, ...(isAdmin ? { token: generateAdminToken() } : {}) });
});

router.post("/auth/change-password", requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "모든 필드를 입력하세요" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다" });
    return;
  }
  const ok = await verifyPassword(currentPassword);
  if (!ok) {
    res.status(401).json({ error: "현재 비밀번호가 올바르지 않습니다" });
    return;
  }
  await changePassword(newPassword);
  res.json({ ok: true });
});

// ── 임시 비상 비밀번호 재설정 (SESSION_SECRET 토큰 인증) ──────────────────────
// 배포 DB와 개발 DB가 달라 생기는 비밀번호 불일치 해소용. 1회 사용 후 제거 예정.
router.post("/auth/emergency-reset", async (req, res) => {
  const { token, newPassword } = req.body as {
    token?: string;
    newPassword?: string;
  };
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret || !token || token !== sessionSecret) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "newPassword must be >= 4 chars" });
    return;
  }
  await changePassword(newPassword);
  res.json({ ok: true });
});

export default router;
