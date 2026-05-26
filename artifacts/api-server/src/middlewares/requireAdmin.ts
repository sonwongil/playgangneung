import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.isAdmin) {
    res.status(401).json({ error: "관리자 로그인이 필요합니다." });
    return;
  }
  next();
}
