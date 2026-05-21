import { Router } from "express";

const router = Router();

const ALLOWED_HOSTS = [
  "www.gn.go.kr",
  "gn.go.kr",
  "gn.moonhwain.net",
  "www.gncaf.or.kr",
  "gncaf.or.kr",
  "images.unsplash.com",
  // 네이버 블로그 이미지
  "postfiles.pstatic.net",
  "blogfiles.pstatic.net",
  "mblogthumb-phinf.pstatic.net",
  "phinf.pstatic.net",
  "blogpfthumb-phinf.pstatic.net",
  "blogimgs.naver.net",
];

router.get("/proxy/image", async (req, res) => {
  const rawUrl = req.query["url"] as string | undefined;
  if (!rawUrl) {
    res.status(400).json({ error: "url 파라미터 필요" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "유효하지 않은 URL" });
    return;
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).json({ error: "허용되지 않은 도메인" });
    return;
  }

  const NAVER_HOSTS = ["postfiles.pstatic.net", "blogfiles.pstatic.net", "mblogthumb-phinf.pstatic.net", "phinf.pstatic.net", "blogpfthumb-phinf.pstatic.net", "blogimgs.naver.net"];
  const referer = NAVER_HOSTS.includes(parsed.hostname)
    ? "https://blog.naver.com/"
    : `${parsed.protocol}//${parsed.hostname}/`;

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `업스트림 오류: ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    });
    res.send(buffer);
  } catch (err) {
    req.log.warn({ err, url: rawUrl }, "이미지 프록시 실패");
    res.status(502).json({ error: "이미지 가져오기 실패" });
  }
});

router.get("/proxy/page", async (req, res) => {
  const rawUrl = req.query["url"] as string | undefined;
  if (!rawUrl) { res.status(400).send("url 파라미터 필요"); return; }

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { res.status(400).send("유효하지 않은 URL"); return; }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).send("허용되지 않은 도메인");
    return;
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `${parsed.protocol}//${parsed.hostname}/`,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) { res.status(502).send(`업스트림 오류: ${upstream.status}`); return; }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) { res.status(400).send("HTML 페이지가 아님"); return; }

    const charset = contentType.match(/charset=([^\s;]+)/i)?.[1] ?? "utf-8";
    const buf = await upstream.arrayBuffer();
    let html = new TextDecoder(charset).decode(buf);

    // <base> 태그 주입 — 상대 URL을 원본 도메인 기준으로 해석
    const baseTag = `<base href="${parsed.protocol}//${parsed.hostname}/">`;
    if (/<head/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else {
      html = baseTag + html;
    }

    // 외부 링크가 새 탭에서 열리도록
    html = html.replace(/<a /gi, '<a target="_blank" rel="noopener noreferrer" ');

    res.set({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "",
    });
    res.send(html);
  } catch (err) {
    req.log.warn({ err, url: rawUrl }, "페이지 프록시 실패");
    res.status(502).send("페이지 가져오기 실패");
  }
});

router.get("/proxy/download", async (req, res) => {
  const rawUrl = req.query["url"] as string | undefined;
  if (!rawUrl) { res.status(400).json({ error: "url 파라미터 필요" }); return; }

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { res.status(400).json({ error: "유효하지 않은 URL" }); return; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(400).json({ error: "http/https URL만 허용" }); return;
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlayGangneungBot/1.0)",
        "Referer": `${parsed.protocol}//${parsed.hostname}/`,
        "Accept": "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) { res.status(502).json({ error: `업스트림 오류: ${upstream.status}` }); return; }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    // 파일명 추출
    const pathParts = parsed.pathname.split("/");
    const rawName = pathParts[pathParts.length - 1] || "image";
    const ext = rawName.includes(".") ? "" : contentType.includes("png") ? ".png" : contentType.includes("gif") ? ".gif" : contentType.includes("webp") ? ".webp" : ".jpg";
    const filename = `${rawName}${ext}`;

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    });
    res.send(buffer);
  } catch (err) {
    req.log.warn({ err, url: rawUrl }, "다운로드 프록시 실패");
    res.status(502).json({ error: "이미지 가져오기 실패" });
  }
});

export default router;
