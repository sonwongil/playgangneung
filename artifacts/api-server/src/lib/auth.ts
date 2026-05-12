import crypto from "crypto";
import { gcsReadJson, gcsWriteJson } from "./gcsJson.js";

const AUTH_FILE = "data/auth.json";
const DEFAULT_PASSWORD = "1235";

interface AuthData {
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function readAuthData(): Promise<AuthData> {
  const data = await gcsReadJson<AuthData | null>(AUTH_FILE, null);
  if (data) return data;
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(DEFAULT_PASSWORD, salt);
  const newData: AuthData = { passwordHash, salt };
  await gcsWriteJson(AUTH_FILE, newData);
  return newData;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const data = await readAuthData();
  const hash = hashPassword(password, data.salt);
  return hash === data.passwordHash;
}

export async function changePassword(newPassword: string): Promise<void> {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(newPassword, salt);
  await gcsWriteJson(AUTH_FILE, { passwordHash, salt });
}
