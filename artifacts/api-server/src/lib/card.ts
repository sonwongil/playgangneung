import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";
import type { CrawledEvent } from "./storage.js";

// ─── Font registration ────────────────────────────────────────────────────────

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
  // Latin supplement (numbers, punctuation, ASCII)
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIZE = 1080;
const BRAND_COLOR    = "#0f3460";
const ACCENT_COLOR   = "#e94560";
const CARD_BLUE_DARK = "#0a2540";

const VISIT_PHRASES = [
  "강릉으로 떠나는 특별한 하루",
  "강릉에서만 느낄 수 있는 경험",
  "강릉의 매력을 직접 만나보세요",
  "이번 주말, 강릉으로 오세요",
];

function pickPhrase(): string {
  return VISIT_PHRASES[Math.floor(Math.random() * VISIT_PHRASES.length)];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.replace(/\./g, "-").trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Wrap text to lines that fit within maxWidth. */
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

// ─── Public ───────────────────────────────────────────────────────────────────

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
  const ctx    = canvas.getContext("2d");

  // ── Background ────────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0,   CARD_BLUE_DARK);
  grad.addColorStop(0.6, BRAND_COLOR);
  grad.addColorStop(1,   "#162d56");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Decorative circles (background) ──────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(SIZE - 80, 80, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, SIZE - 100, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Accent stripe (left side) ─────────────────────────────────────────────
  ctx.fillStyle = ACCENT_COLOR;
  ctx.fillRect(0, 0, 10, SIZE);

  // ── Top branding area ─────────────────────────────────────────────────────
  const topAreaH = 200;

  // Small red badge
  const badgeX = 54, badgeY = 52, badgeW = 170, badgeH = 38, badgeR = 8;
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeR, badgeY);
  ctx.lineTo(badgeX + badgeW - badgeR, badgeY);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeR);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeR);
  ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - badgeR, badgeY + badgeH);
  ctx.lineTo(badgeX + badgeR, badgeY + badgeH);
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeR);
  ctx.lineTo(badgeX, badgeY + badgeR);
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeR, badgeY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px NotoSansKR";
  ctx.textBaseline = "middle";
  ctx.fillText("PLAY강릉", badgeX + 12, badgeY + badgeH / 2 + 1);

  // Brand title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px NotoSansKR";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("PLAY강릉", 54, 172);

  // Divider
  ctx.strokeStyle = ACCENT_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(54, topAreaH + 10);
  ctx.lineTo(SIZE - 54, topAreaH + 10);
  ctx.stroke();

  // ── Event title (center) ──────────────────────────────────────────────────
  const titleText = event.socialDraft.title.replace(/^[\p{Emoji}\s]+/u, "").trim();
  const maxTitleW = SIZE - 108;

  ctx.font = "bold 62px NotoSansKR";
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  const titleLines = wrapText(ctx, titleText, maxTitleW);
  const titleLineH = 76;
  const totalTitleH = titleLines.length * titleLineH;
  const titleStartY = topAreaH + 60 + (SIZE - topAreaH - 60 - 240 - totalTitleH) / 2;

  titleLines.forEach((line, i) => {
    ctx.fillText(line, 54, titleStartY + i * titleLineH);
  });

  // ── Bottom info area ──────────────────────────────────────────────────────
  const bottomY = SIZE - 240;

  // Separator
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(54, bottomY);
  ctx.lineTo(SIZE - 54, bottomY);
  ctx.stroke();

  // Date
  const dateStr = formatDate(event.date);
  if (dateStr) {
    ctx.font = "400 30px NotoSansKR";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textBaseline = "top";
    ctx.fillText(dateStr, 54, bottomY + 28);
  }

  // Source
  if (event.source) {
    ctx.font = "400 26px NotoSansKR";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(`출처: ${event.source}`, 54, bottomY + 76);
  }

  // Visit phrase
  const phrase = pickPhrase();
  ctx.font = "bold 32px NotoSansKR";
  ctx.fillStyle = "#ffd700";
  ctx.fillText(phrase, 54, bottomY + 130);

  // ── Bottom-right: PLAY강릉 watermark ─────────────────────────────────────
  ctx.font = "400 22px NotoSansKR";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "right";
  ctx.fillText("playgangneung.kr", SIZE - 54, SIZE - 40);
  ctx.textAlign = "left";

  // ── Export PNG ────────────────────────────────────────────────────────────
  const filename = `${event.id}.png`;
  const filePath = path.join(CARDS_DIR, filename);
  const png = await canvas.encode("png");
  await fs.writeFile(filePath, png);

  return `/api/cards/${filename}`;
}
