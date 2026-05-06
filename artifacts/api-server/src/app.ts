import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import session from "express-session";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Static files: generated card images
app.use(
  "/api/cards",
  express.static(path.resolve(process.cwd(), "public/cards"), {
    maxAge: 0,
    etag: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  session({
    secret: process.env["SESSION_SECRET"] ?? "playgangneung-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.redirect("/api/admin");
});

app.use("/api", router);

export default app;
