import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

const DEFAULT_PASSWORD = "1235";

interface AuthData {
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function readAuthData(): Promise<AuthData> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(AUTH_FILE, "utf-8");
    return JSON.parse(raw) as AuthData;
  } catch {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(DEFAULT_PASSWORD, salt);
    const data: AuthData = { passwordHash, salt };
    await fs.writeFile(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  const data = await readAuthData();
  const hash = hashPassword(password, data.salt);
  return hash === data.passwordHash;
}

export async function changePassword(newPassword: string): Promise<void> {
  await ensureDataDir();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(newPassword, salt);
  await fs.writeFile(AUTH_FILE, JSON.stringify({ passwordHash, salt }, null, 2), "utf-8");
}
