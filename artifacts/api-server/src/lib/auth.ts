import crypto from "crypto";
import { db, authTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function getOrCreateAuth() {
  const rows = await db.select().from(authTable).where(eq(authTable.id, "main"));
  if (rows.length > 0) return rows[0];
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword("1235", salt);
  await db
    .insert(authTable)
    .values({ id: "main", passwordHash, salt })
    .onConflictDoNothing();
  return { id: "main", passwordHash, salt };
}

/**
 * 비밀번호 검증.
 *
 * ADMIN_DEFAULT_PASSWORD 환경변수(Replit Secret)가 설정돼 있으면
 * DB 해시를 전혀 사용하지 않고 환경변수 값과 직접 비교합니다.
 * → 개발/배포 DB가 달라도 시크릿 하나로 항상 동일하게 동작합니다.
 *
 * 환경변수가 없으면 DB 해시 방식(scrypt)으로 폴백합니다.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const envPassword = process.env["ADMIN_DEFAULT_PASSWORD"];
  if (envPassword) {
    return password === envPassword;
  }
  const data = await getOrCreateAuth();
  const hash = hashPassword(password, data.salt);
  return hash === data.passwordHash;
}

/**
 * 비밀번호 변경.
 *
 * ADMIN_DEFAULT_PASSWORD 시크릿이 설정된 상태면 DB 해시 변경은 효과가 없으므로
 * 시크릿을 직접 수정하도록 안내합니다.
 */
export async function changePassword(newPassword: string): Promise<void> {
  if (process.env["ADMIN_DEFAULT_PASSWORD"]) {
    throw new Error(
      "ADMIN_DEFAULT_PASSWORD 시크릿으로 인증 중입니다. Replit Secrets에서 ADMIN_DEFAULT_PASSWORD 값을 변경하세요.",
    );
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(newPassword, salt);
  await db
    .insert(authTable)
    .values({ id: "main", passwordHash, salt })
    .onConflictDoUpdate({
      target: authTable.id,
      set: { passwordHash, salt },
    });
}

// ── iframe/크로스-오리진 환경을 위한 Bearer 토큰 (쿠키 세션 보완) ──────────

/** SESSION_SECRET 기반 HMAC 토큰 — 서버 재시작해도 동일 값 */
export function generateAdminToken(): string {
  const secret = process.env["SESSION_SECRET"] ?? "playgangneung-secret";
  return crypto.createHmac("sha256", secret).update("pg-admin-v1").digest("hex");
}

/** Bearer 토큰 검증 (timing-safe) */
export function verifyAdminToken(token: string): boolean {
  try {
    const expected = generateAdminToken();
    const a = Buffer.from(token.padEnd(expected.length, "0").slice(0, expected.length), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** @deprecated 이제 verifyPassword()가 환경변수를 직접 읽으므로 호출 불필요 */
export async function resetPasswordFromEnv(): Promise<void> {
  const envPassword = process.env["ADMIN_DEFAULT_PASSWORD"];
  if (!envPassword) return;
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(envPassword, salt);
  await db
    .insert(authTable)
    .values({ id: "main", passwordHash, salt })
    .onConflictDoUpdate({ target: authTable.id, set: { passwordHash, salt } });
}
