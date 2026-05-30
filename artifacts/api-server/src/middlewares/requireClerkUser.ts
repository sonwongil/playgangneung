import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export function requireClerkUser(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "로그인이 필요합니다.", code: "UNAUTHENTICATED" });
    return;
  }
  next();
}
