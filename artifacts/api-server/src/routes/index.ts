import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import eventsRouter from "./events.js";
import adminRouter from "./admin.js";
import adsRouter from "./ads.js";
import adPoolsRouter from "./adPools.js";
import adCenterRouter from "./adCenter.js";
import feedRouter from "./feed.js";
import authRouter from "./auth.js";
import proxyRouter from "./proxy.js";
import sourcesRouter from "./sources.js";
import scheduleRouter from "./schedule.js";
import storiesRouter from "./stories.js";
import videosRouter from "./videos.js";
import performanceRouter from "./performance.js";
import paymentRouter from "./payment.js";
import adProductsRouter from "./adProducts.js";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  res.json({ siteUrl: process.env["SITE_URL"] ?? "https://play-gangneung-dashboard.replit.app" });
});

router.use(authRouter);
router.use(healthRouter);
router.use(eventsRouter);
router.use(adminRouter);
router.use(adsRouter);
router.use(adPoolsRouter);
router.use(adCenterRouter);
router.use(feedRouter);
router.use(proxyRouter);
router.use(sourcesRouter);
router.use(scheduleRouter);
router.use(storiesRouter);
router.use(videosRouter);
router.use(performanceRouter);
router.use(paymentRouter);
router.use(adProductsRouter);

export default router;
