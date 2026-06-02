import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../lib/auth.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAdmin === true) { next(); return; }

  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (verifyAdminToken(token)) { next(); return; }
  }

  res.status(401).json({ error: "관리자 로그인이 필요합니다." });
}
