import fs from "fs/promises";
import path from "path";
import { DATA_DIR } from "./paths.js";

const isProd = process.env["NODE_ENV"] === "production";

/** GCS 사용 여부: 프로덕션이고 버킷 ID가 설정된 경우만 (VPS에서는 로컬 파일시스템 사용) */
function useGcs(): boolean {
  return isProd && !!process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
}

// ── 로컬 파일시스템 (개발 전용) ──────────────────────────────────────────────

async function localRead<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(DATA_DIR, path.basename(fileName));
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function localWrite<T>(fileName: string, data: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const filePath = path.join(DATA_DIR, path.basename(fileName));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ── Google Cloud Storage (프로덕션 전용) ─────────────────────────────────────

let _storage: import("@google-cloud/storage").Storage | null = null;

function getStorage() {
  if (!_storage) {
    const { Storage } = require("@google-cloud/storage") as typeof import("@google-cloud/storage");
    _storage = new Storage();
  }
  return _storage;
}

function getBucket() {
  const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return getStorage().bucket(bucketId);
}

async function gcsRead<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const file = getBucket().file(fileName);
    const [exists] = await file.exists();
    if (!exists) return fallback;
    const [contents] = await file.download();
    return JSON.parse(contents.toString("utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function gcsWrite<T>(fileName: string, data: T): Promise<void> {
  try {
    const file = getBucket().file(fileName);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: "application/json",
    });
  } catch {
    // GCS 쓰기 실패 무시 (권한 문제 등) — 읽기는 여전히 시도함
  }
}

// ── 공개 API ────────────────────────────────────────────────────────────────

export async function gcsReadJson<T>(fileName: string, fallback: T): Promise<T> {
  return useGcs() ? gcsRead(fileName, fallback) : localRead(fileName, fallback);
}

export async function gcsWriteJson<T>(fileName: string, data: T): Promise<void> {
  return useGcs() ? gcsWrite(fileName, data) : localWrite(fileName, data);
}
