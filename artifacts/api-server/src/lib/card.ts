import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";
import https from "https";
import axios from "axios";
import type { CrawledEvent } from "./storage.js";

let fontsRegistered = false;

function ensureFonts() {
  if (fontsRegistered) return;
  const fontDir = path.resolve(
    process.cwd(),
    "node_modules/@fontsource/noto-sans-kr/files",
  );
  GlobalFonts.registerFromPath(
    path.join(fontDir, "noto-sans-kr-korean-400-normal.woff"),
    "NotoSansKR",
  );
  GlobalFonts.registerFromPath(
    path.join(fontDir, "noto-sans-kr-korean-700-normal.woff"),
    "NotoSansKR",
  );
  GlobalFonts.registerFromPath(
    path.join(fontDir, "noto-sans-kr-0-400-normal.woff"),
    "NotoSansKR",
  );
  GlobalFonts.registerFromPath(
    path.join(fontDir, "noto-sans-kr-0-700-normal.woff"),
    "NotoSansKR",
  );
  fontsRegistered = true;
}

const SIZE = 1080;
const ACCENT_COLOR = "#e94560";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.replace(/\./g, "-").trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const CARDS_DIR = path.resolve(process.cwd(), "public/cards");

export async function generateCardImage(event: CrawledEvent): Promise<string> {
  if (event.status !== "approved" || !event.socialDraft) {
    throw new Error(
      "approved 상태이고 socialDraft가 있는 이벤트만 카드를 생성할 수 있습니다.",
    );
  }

  ensureFonts();
  await fs.mkdir(CARDS_DIR, { recursive: true });

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // ── 배경: 행사 썸네일 이미지 (cover-fit) ──────────────────────────────────
  // loadImage(url) 직접 사용 시 SSL/리퍼러 차단으로 실패 → axios 버퍼 fetch 후 전달
  let usedThumbnail = false;
  if (event.thumbnail) {
    try {
      const resp = await axios.get(event.thumbnail, {
        responseType: "arraybuffer",
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
          Accept: "image/*,*/*;q=0.8",
        },
        maxRedirects: 5,
      });
      const buf = Buffer.from(resp.data as ArrayBuffer);
      const img = await loadImage(buf);
      const iw = img.width as number;
      const ih = img.height as number;
      const scale = Math.max(SIZE / iw, SIZE / ih);
      const sw = iw * scale;
      const sh = ih * scale;
      const sx = (SIZE - sw) / 2;
      const sy = (SIZE - sh) / 2;
      ctx.drawImage(img as Parameters<typeof ctx.drawImage>[0], sx, sy, sw, sh);
      usedThumbnail = true;
    } catch (e) {
      // 이미지 로딩 실패 시 그라디언트 배경으로 대체
    }
  }

  if (!usedThumbnail) {
    const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0, "#0a2540");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ── 하단 그라디언트 오버레이 (텍스트 가독성) ──────────────────────────────
  const overlayH = 480;
  const overlay = ctx.createLinearGradient(0, SIZE - overlayH, 0, SIZE);
  overlay.addColorStop(0, "rgba(0,0,0,0)");
  overlay.addColorStop(0.35, "rgba(0,0,0,0.55)");
  overlay.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, SIZE - overlayH, SIZE, overlayH);

  // ── 상단 좌측: PLAY강릉 배지 ──────────────────────────────────────────────
  const PAD = 50;
  const badgeH = 42;
  const badgeW = 180;
  const badgeR = 8;
  const bx = PAD, by = PAD;

  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(bx + badgeR, by);
  ctx.lineTo(bx + badgeW - badgeR, by);
  ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + badgeR);
  ctx.lineTo(bx + badgeW, by + badgeH - badgeR);
  ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - badgeR, by + badgeH);
  ctx.lineTo(bx + badgeR, by + badgeH);
  ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - badgeR);
  ctx.lineTo(bx, by + badgeR);
  ctx.quadraticCurveTo(bx, by, bx + badgeR, by);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px NotoSansKR";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAY강릉", bx + 14, by + badgeH / 2 + 1);

  // ── 행사 제목 ─────────────────────────────────────────────────────────────
  const titleText = event.title.trim();
  const maxTitleW = SIZE - PAD * 2;
  ctx.font = "bold 64px NotoSansKR";
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "bottom";

  const titleLines = wrapText(ctx, titleText, maxTitleW).slice(0, 3);
  const titleLineH = 80;
  const dateStr = formatDate(event.date);
  const dateLineH = dateStr ? 48 : 0;
  const sourceLineH = event.source ? 40 : 0;
  const totalTextH =
    titleLines.length * titleLineH + dateLineH + sourceLineH + 20;
  let curY = SIZE - PAD - sourceLineH - dateLineH - 20;

  titleLines.slice().reverse().forEach((line, ri) => {
    const idx = titleLines.length - 1 - ri;
    ctx.fillText(line, PAD, curY - idx * titleLineH);
  });

  curY = SIZE - PAD;

  // ── 날짜 ──────────────────────────────────────────────────────────────────
  if (dateStr) {
    ctx.font = "400 34px NotoSansKR";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.textBaseline = "bottom";
    const dateY = SIZE - PAD - (event.source ? sourceLineH + 8 : 0);
    ctx.fillText(dateStr, PAD, dateY);
  }

  // ── 출처 ──────────────────────────────────────────────────────────────────
  if (event.source) {
    ctx.font = "400 28px NotoSansKR";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textBaseline = "bottom";
    ctx.fillText(event.source, PAD, SIZE - PAD);
  }

  // ── 우하단 워터마크 ───────────────────────────────────────────────────────
  ctx.font = "400 22px NotoSansKR";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("playgangneung.kr", SIZE - PAD, SIZE - PAD);
  ctx.textAlign = "left";

  // ── PNG 저장 ──────────────────────────────────────────────────────────────
  const filename = `${event.id}.png`;
  const filePath = path.join(CARDS_DIR, filename);
  const png = await canvas.encode("png");
  await fs.writeFile(filePath, png);

  return `/api/cards/${filename}`;
}
