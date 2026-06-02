import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieSession from "cookie-session";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";
import router from "./routes/index.js";
import contentRouter from "./routes/content.js";
import aboutRouter from "./routes/about.js";
import sitemapRouter from "./routes/sitemap.js";
import { logger } from "./lib/logger.js";
import { CARDS_DIR, UPLOADS_DIR } from "./lib/paths.js";

const app: Express = express();

app.set("trust proxy", 1);

// Static files
app.use("/api/cards", express.static(CARDS_DIR, { maxAge: 0, etag: false }));
app.use("/api/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

// Clerk proxy — must come BEFORE body parsers (streams raw bytes)
// CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY 둘 다 있을 때만 활성화
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Replit 개발 환경(iframe/캔버스)에서는 HTTPS proxy를 통해 접근하므로
// SameSite=None;Secure 가 필요. 배포 환경도 동일하게 None;Secure 사용.
const isSecureContext =
  process.env["NODE_ENV"] === "production" ||
  !!process.env["REPLIT_DEPLOYMENT"] ||
  !!process.env["REPL_ID"];

app.use(
  cookieSession({
    name: "pgs",
    secret: process.env["SESSION_SECRET"] ?? "playgangneung-secret",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: isSecureContext,
    sameSite: isSecureContext ? "none" : "lax",
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Clerk 미들웨어: CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY 둘 다 있을 때만 활성화
// VPS에서 Clerk 키 없이 배포 시 공개 API(/api/feed, /content/* 등)가 정상 응답하도록 패스스루
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.get("/", (_req, res) => {
  res.redirect("/api/admin");
});

// API 응답 캐시 완전 방지 (304 Not Modified 방지)
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api", router);
app.use("/content", contentRouter);
app.use(aboutRouter);
app.use(sitemapRouter);

export default app;
