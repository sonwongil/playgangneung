import { Router } from "express";

const router = Router();

const ALLOWED_HOSTS = [
  "www.gn.go.kr",
  "gn.go.kr",
  "gn.moonhwain.net",
  "www.gncaf.or.kr",
  "gncaf.or.kr",
  "images.unsplash.com",
  // 네이버 블로그/뉴스 이미지 (pstatic.net 계열 전체)
  "postfiles.pstatic.net",
  "blogfiles.pstatic.net",
  "mblogthumb-phinf.pstatic.net",
  "blogthumb.pstatic.net",
  "phinf.pstatic.net",
  "blogpfthumb-phinf.pstatic.net",
  "blogimgs.naver.net",
  "imgnews.pstatic.net",
  "cafefiles.pstatic.net",
  "cafeptthumb.pstatic.net",
  "sstatic.naver.net",
  "static.naver.net",
  // 다음/카카오 이미지
  "img1.daumcdn.net",
  "img2.daumcdn.net",
  "img3.daumcdn.net",
  "img4.daumcdn.net",
  "t1.daumcdn.net",
  "t2.daumcdn.net",
  "k.kakaocdn.net",
  "mud-kage.kakaocdn.net",
  // 인스타그램
  "scontent.cdninstagram.com",
  // 유튜브 썸네일
  "img.youtube.com",
  "i.ytimg.com",
  // 기타 이미지 호스트
  "cdn.kado.net",
  "www.gscaltex.com",
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

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    };

    if (req.query["download"] === "1") {
      const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const filename = `image.${ext}`;
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    res.set(headers);
    res.send(buffer);
  } catch (err) {
    req.log.warn({ err, url: rawUrl }, "이미지 프록시 실패");
    res.status(502).json({ error: "이미지 가져오기 실패" });
  }
});

// 관리자 전용 이미지 다운로드 — 도메인 제한 없이 모든 URL 허용
router.get("/proxy/download", async (req, res) => {
  if (!req.session?.isAdmin) {
    res.status(401).json({ error: "로그인이 필요합니다" });
    return;
  }

  const rawUrl = req.query["url"] as string | undefined;
  if (!rawUrl) { res.status(400).json({ error: "url 파라미터 필요" }); return; }

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { res.status(400).json({ error: "유효하지 않은 URL" }); return; }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    res.status(400).json({ error: "http/https URL만 허용" });
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
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) { res.status(502).json({ error: `업스트림 오류: ${upstream.status}` }); return; }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const contentLength = upstream.headers.get("content-length");
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg").split(";")[0] ?? "jpg";

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="image.${ext}"`,
      "Cache-Control": "no-store",
    });
    if (contentLength) res.set("Content-Length", contentLength);

    if (upstream.body) {
      const { Readable } = await import("stream");
      Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    req.log.warn({ err, url: rawUrl }, "이미지 다운로드 프록시 실패");
    if (!res.headersSent) res.status(502).json({ error: "이미지 가져오기 실패" });
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
