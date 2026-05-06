import { Router } from "express";

const router = Router();

const ALLOWED_HOSTS = [
  "www.gn.go.kr",
  "gn.go.kr",
  "gn.moonhwain.net",
  "www.gncaf.or.kr",
  "gncaf.or.kr",
  "images.unsplash.com",
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

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlayGangneungBot/1.0)",
        "Referer": `${parsed.protocol}//${parsed.hostname}/`,
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

export default router;
