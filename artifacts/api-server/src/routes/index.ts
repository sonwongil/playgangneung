import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import eventsRouter from "./events.js";
import adminRouter from "./admin.js";
import adsRouter from "./ads.js";
import feedRouter from "./feed.js";
import authRouter from "./auth.js";
import proxyRouter from "./proxy.js";
import sourcesRouter from "./sources.js";
import scheduleRouter from "./schedule.js";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  res.json({ siteUrl: process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app" });
});

router.use(authRouter);
router.use(healthRouter);
router.use(eventsRouter);
router.use(adminRouter);
router.use(adsRouter);
router.use(feedRouter);
router.use(proxyRouter);
router.use(sourcesRouter);
router.use(scheduleRouter);

export default router;
