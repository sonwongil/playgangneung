import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs/promises";
import path from "path";

const FONTS_DIR = path.resolve(process.cwd(), "fonts");
GlobalFonts.registerFromPath(path.join(FONTS_DIR, "NanumGothic-Regular.ttf"), "NanumGothic");
GlobalFonts.registerFromPath(path.join(FONTS_DIR, "NanumGothic-Bold.ttf"), "NanumGothic");

const CARDS_DIR = path.resolve(process.cwd(), "public/cards");

const CATEGORY_GRADIENT: Record<string, [string, string]> = {
  행사:    ["#1e3a8a", "#2563eb"],
  맛집:    ["#7c2d12", "#ea580c"],
  핫플:   ["#4c1d95", "#7c3aed"],
  지역소식: ["#064e3b", "#059669"],
};
const DEFAULT_GRADIENT: [string, string] = ["#0f172a", "#1e3a5f"];

function wrapText(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4,
): void {
  const chars = [...text];
  let line = "";
  let lineCount = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lineCount >= maxLines - 1) {
        ctx.fillText(line + "…", x, y);
        return;
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
      lineCount++;
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

export async function generateCardImage(event: {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail?: string | null;
  source: string;
  startDate?: string;
  date?: string;
}): Promise<string> {
  await fs.mkdir(CARDS_DIR, { recursive: true });

  const W = 1080;
  const H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const [c1, c2] = CATEGORY_GRADIENT[event.category] ?? DEFAULT_GRADIENT;

  if (event.thumbnail) {
    try {
      const img = await loadImage(event.thumbnail);
      ctx.drawImage(img, 0, 0, W, H);
      const grad = ctx.createLinearGradient(0, H * 0.25, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0.1)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.65)");
      grad.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } catch {
      drawGradientBg(ctx, W, H, c1, c2);
    }
  } else {
    drawGradientBg(ctx, W, H, c1, c2);
  }

  const badgeColors: Record<string, string> = {
    행사: "#3b82f6", 맛집: "#f97316", 핫플: "#8b5cf6", 지역소식: "#10b981",
  };
  const badgeColor = badgeColors[event.category] ?? "#3b82f6";
  const badgeText = event.category ?? "강릉";

  const badgePad = 22;
  const badgeH = 54;
  const badgeY = 80;
  ctx.font = "bold 28px NanumGothic";
  const badgeW = ctx.measureText(badgeText).width + badgePad * 2;
  roundRect(ctx, 72, badgeY, badgeW, badgeH, 27);
  ctx.fillStyle = badgeColor;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, 72 + badgePad, badgeY + badgeH / 2);

  // ── 텍스트 영역 (하단 CTA 바 96px 고려해서 위로 올림) ──────────────────
  const CTA_H = 96; // 하단 CTA 바 높이

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px NanumGothic";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  wrapText(ctx, event.title, 72, H - 360 - CTA_H, W - 144, 88, 4);

  if (event.description) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "36px NanumGothic";
    wrapText(ctx, event.description, 72, H - 190 - CTA_H, W - 144, 50, 2);
  }

  const dateStr = event.startDate ?? event.date ?? "";
  if (dateStr) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "30px NanumGothic";
    ctx.fillText(dateStr + (event.source ? `  ·  ${event.source}` : ""), 72, H - 110 - CTA_H);
  }

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 40px NanumGothic";
  ctx.textAlign = "right";
  ctx.fillText("PLAY강릉", W - 72, H - 60 - CTA_H);

  // ── 하단 "자세히보기" CTA 바 ────────────────────────────────────────────
  const ctaY = H - CTA_H;

  // 배경: 흰색 불투명 바
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, ctaY, W, CTA_H);

  // 왼쪽: "자세히보기 →" 텍스트
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 42px NanumGothic";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("자세히보기  →", 72, ctaY + CTA_H / 2);

  // 오른쪽: 도메인 브랜딩
  ctx.fillStyle = "#2563eb";
  ctx.font = "bold 32px NanumGothic";
  ctx.textAlign = "right";
  ctx.fillText("playgangneung.com", W - 72, ctaY + CTA_H / 2);

  const outPath = path.join(CARDS_DIR, `${event.id}.png`);
  await fs.writeFile(outPath, canvas.toBuffer("image/png"));
  return `/api/cards/${event.id}.png`;
}

function drawGradientBg(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  W: number, H: number, c1: string, c2: string,
) {
  const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.8 + i * 30, H * 0.25 - i * 40, 200 + i * 60, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
