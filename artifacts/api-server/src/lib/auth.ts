import crypto from "crypto";
import { db, authTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_PASSWORD = process.env["ADMIN_DEFAULT_PASSWORD"] ?? "1235";

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function getOrCreateAuth() {
  const rows = await db.select().from(authTable).where(eq(authTable.id, "main"));
  if (rows.length > 0) return rows[0];
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(DEFAULT_PASSWORD, salt);
  await db
    .insert(authTable)
    .values({ id: "main", passwordHash, salt })
    .onConflictDoNothing();
  return { id: "main", passwordHash, salt };
}

export async function verifyPassword(password: string): Promise<boolean> {
  const data = await getOrCreateAuth();
  const hash = hashPassword(password, data.salt);
  return hash === data.passwordHash;
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

/**
 * 서버 시작 시 ADMIN_DEFAULT_PASSWORD 환경변수가 설정돼 있으면
 * 현재 해시에 관계없이 해당 값으로 비밀번호를 강제 재설정합니다.
 * 재설정 후에는 환경변수를 제거해도 됩니다.
 */
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

export async function changePassword(newPassword: string): Promise<void> {
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
