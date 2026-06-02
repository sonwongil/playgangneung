import { Router } from "express";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  verifyMetaToken,
  updateCachedToken,
  isTokenExpiredError,
  TOKEN_EXPIRED_USER_MSG,
} from "../lib/metaApi.js";

const router = Router();

/** GET /api/admin/meta-token/status — 현재 토큰 유효성 확인 */
router.get("/admin/meta-token/status", requireAdmin, async (req, res) => {
  const dbRow = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "META_ACCESS_TOKEN")).limit(1).catch(() => []);
  const source: "db" | "env" | "none" = dbRow[0]?.value ? "db" : process.env["META_ACCESS_TOKEN"] ? "env" : "none";

  if (source === "none") {
    res.json({ configured: false, valid: false, source, error: "META_ACCESS_TOKEN이 설정되지 않았습니다" });
    return;
  }

  const result = await verifyMetaToken();
  if (!result.valid) {
    const expired = isTokenExpiredError(result.error ?? "");
    res.json({
      configured: true,
      valid: false,
      source,
      expired,
      userMsg: expired ? TOKEN_EXPIRED_USER_MSG : "토큰 검증에 실패했습니다. 다시 확인해 주세요.",
      devError: result.error,
    });
    return;
  }

  res.json({ configured: true, valid: true, source });
});

/** POST /api/admin/meta-token — 새 토큰 저장 */
router.post("/admin/meta-token", requireAdmin, async (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token?.trim()) {
    res.status(400).json({ error: "token 필드를 입력하세요" });
    return;
  }

  const trimmed = token.trim();

  // 저장 전 유효성 확인
  const verify = await verifyMetaToken(trimmed);
  if (!verify.valid) {
    req.log.warn({ err: verify.error }, "저장 시도한 Meta 토큰 유효하지 않음");
    res.status(422).json({
      error: "토큰 검증 실패",
      userMsg: isTokenExpiredError(verify.error ?? "") ? TOKEN_EXPIRED_USER_MSG : "입력한 토큰이 유효하지 않습니다. Meta Business Suite에서 새 토큰을 발급해 주세요.",
      devError: verify.error,
    });
    return;
  }

  // DB 저장
  await db.insert(siteConfigTable)
    .values({ key: "META_ACCESS_TOKEN", value: trimmed })
    .onConflictDoUpdate({ target: siteConfigTable.key, set: { value: trimmed, updatedAt: new Date() } });

  // 메모리 캐시 즉시 업데이트 (서버 재시작 없이 적용)
  updateCachedToken(trimmed);

  req.log.info("Meta 토큰 갱신 완료");
  res.json({ ok: true, message: "Meta 토큰이 성공적으로 저장되었습니다." });
});

export default router;
