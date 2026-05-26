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
