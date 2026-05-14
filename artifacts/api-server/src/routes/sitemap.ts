import { Router } from "express";
import { readEvents } from "../lib/storage.js";

const router = Router();

const SITE_URL = process.env["SITE_URL"] ?? "https://playgangneung.com";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const events = await readEvents();
    const published = events.filter(
      (e) => e.status === "approved" || e.status === "published",
    );

    const today = new Date().toISOString().slice(0, 10);

    const urls: string[] = [
      `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
      ...published.map((e) => {
        const lastmod = (e as any).updatedAt
          ? new Date((e as any).updatedAt).toISOString().slice(0, 10)
          : today;
        return `<url><loc>${esc(`${SITE_URL}/content/${e.id}`)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      }),
    ];

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...urls,
      `</urlset>`,
    ].join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch {
    res.status(500).send("Sitemap generation failed");
  }
});

export default router;
