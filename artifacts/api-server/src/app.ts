import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import FileStore from "session-file-store";
import router from "./routes/index.js";
import contentRouter from "./routes/content.js";
import { logger } from "./lib/logger.js";
import { CARDS_DIR, SESSIONS_DIR } from "./lib/paths.js";

const FileStoreSession = FileStore(session);

const app: Express = express();

app.set("trust proxy", 1);

// Static files: generated card images
app.use(
  "/api/cards",
  express.static(CARDS_DIR, {
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
    store: new FileStoreSession({
      path: SESSIONS_DIR,
      ttl: 60 * 60 * 24 * 30,
      retries: 1,
      logFn: () => {},
    }),
    secret: process.env["SESSION_SECRET"] ?? "playgangneung-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
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
app.use("/content", contentRouter);

export default app;
