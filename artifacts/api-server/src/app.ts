import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieSession from "cookie-session";
import router from "./routes/index.js";
import contentRouter from "./routes/content.js";
import { logger } from "./lib/logger.js";
import { CARDS_DIR, UPLOADS_DIR } from "./lib/paths.js";

const app: Express = express();

app.set("trust proxy", 1);

// Static files
app.use("/api/cards", express.static(CARDS_DIR, { maxAge: 0, etag: false }));
app.use("/api/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

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

app.use(
  cookieSession({
    name: "pgs",
    secret: process.env["SESSION_SECRET"] ?? "playgangneung-secret",
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

export default app;
