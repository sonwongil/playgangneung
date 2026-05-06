import { Router } from "express";
import { verifyPassword, changePassword } from "../lib/auth.js";

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
  req.session.isAdmin = true;
  res.json({ ok: true });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  res.json({ isAdmin: req.session.isAdmin === true });
});

router.post("/auth/change-password", async (req, res) => {
  if (!req.session.isAdmin) {
    res.status(401).json({ error: "로그인이 필요합니다" });
    return;
  }
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

export default router;
